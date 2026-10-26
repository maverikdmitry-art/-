import { Context, InlineKeyboard } from 'grammy';
import {
  convertToUah,
  createGeminiClient,
  formatMoney,
  parseInput,
  type GeminiLayer,
  type ParseResult,
} from '@oover/shared';
import type { Account, Category, NewTransaction } from '@oover/shared';
import { config } from './config';
import {
  fetchAccounts,
  fetchCategories,
  fetchLastUsedAccountId,
  fetchUserByTelegramId,
  getSupabase,
  insertTransaction,
} from './db';

/**
 * Ввод трат из Telegram (ROADMAP 1.8).
 *
 * Сценарий: пользователь пишет «кофе 150 мак» → parseInput (Gemini → regex) →
 * превью с кнопками [Сохранить] [Отмена] → по кнопке «Сохранить» — запись в БД.
 * Черновик живёт в памяти процесса (бот приватный, 2 пользователя).
 */

type PendingTx = {
  tx: NewTransaction;
  telegramMessageId: number;
  previewText: string;
};

// userId → ожидающая подтверждения операция.
const pending = new Map<number, PendingTx>();

/** Собирает Gemini-слой, если ключ задан. Иначе — undefined (работает regex). */
function buildGeminiLayer(): GeminiLayer | undefined {
  if (!config.GEMINI_API_KEY) return undefined;
  try {
    return { client: createGeminiClient(config.GEMINI_API_KEY), model: config.GEMINI_MODEL };
  } catch (err) {
    console.error('[gemini] не удалось создать клиент:', err instanceof Error ? err.message : err);
    return undefined;
  }
}

/** Обработка текстового сообщения: разбор и показ превью. */
export async function handleText(ctx: Context): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    await ctx.reply('⚠️ База данных не подключена. Проверь SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.');
    return;
  }

  const text = ctx.message?.text;
  const telegramId = ctx.from?.id;
  if (!text || telegramId === undefined) return;

  try {
    const user = await fetchUserByTelegramId(supabase, telegramId);
    if (!user) {
      await ctx.reply('Тебя нет в базе. Попроси добавить твой Telegram ID в таблицу users (Supabase).');
      return;
    }

    const [categories, accounts, lastUsedAccountId] = await Promise.all([
      fetchCategories(supabase),
      fetchAccounts(supabase),
      fetchLastUsedAccountId(supabase, user.id),
    ]);

    const gemini = buildGeminiLayer();
    const result: ParseResult = await parseInput({
      text,
      categories,
      accounts,
      lastUsedAccountId,
      gemini,
      onLlmError: (err) =>
        console.error('[parse] Gemini сшибся, фоллбэк на regex:', err instanceof Error ? err.message : err),
    });

    if (result.amount <= 0) {
      await ctx.reply('Не понял сумму. Напиши, например: «кофе 150», «такси 340» или «зп 20000».');
      return;
    }

    const accountId = result.accountId ?? accounts.find((a) => a.is_active)?.id;
    if (!accountId) {
      await ctx.reply('Нет ни одного активного счёта. Добавь счёт в дашборде.');
      return;
    }

    const currency = result.currency;
    const chatId = ctx.chat?.id ?? null;
    const tx: NewTransaction = {
      type: result.type,
      amount: result.amount,
      currency,
      account_id: accountId,
      category_id: result.categoryId ?? null,
      user_id: user.id,
      description: result.description,
      note: result.note ?? null,
      occurred_at: new Date().toISOString(),
      status: result.status,
      source: 'bot',
      raw_text: result.rawText,
      telegram_chat_id: chatId,
    };

    const previewText = formatPreview(result, accounts, categories);
    pending.set(telegramId, { tx, telegramMessageId: ctx.message.message_id, previewText });

    const keyboard = new InlineKeyboard()
      .text('✅ Сохранить', 'tx:save')
      .text('✏️ Изменить', 'tx:edit')
      .row()
      .text('✖️ Отмена', 'tx:cancel');
    await ctx.reply(previewText, {
      reply_markup: keyboard,
      reply_parameters: { message_id: ctx.message.message_id },
    });
  } catch (err) {
    console.error('[input] ошибка:', err instanceof Error ? err.message : err);
    await ctx.reply('❌ Не удалось обработать сообщение. Попробуй ещё раз.');
  }
}

/** Нажатие «Сохранить» — записываем операцию в БД. */
export async function handleSave(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (telegramId === undefined) return;
  const draft = pending.get(telegramId);
  if (!draft) {
    await ctx.answerCallbackQuery({ text: 'Нет операции для сохранения' });
    return;
  }
  pending.delete(telegramId);

  const supabase = getSupabase();
  if (!supabase) {
    await ctx.answerCallbackQuery({ text: 'База данных недоступна' });
    return;
  }

  try {
    const id = await insertTransaction(supabase, draft.tx, draft.telegramMessageId);
    if (id === null) {
      await ctx.editMessageText(`${draft.previewText}\n\n♻️ Эта операция уже сохранена ранее.`);
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.editMessageText(`${draft.previewText}\n\n✅ Сохранено в базу.`);
    await ctx.answerCallbackQuery();
  } catch (err) {
    console.error('[save] ошибка:', err instanceof Error ? err.message : err);
    await ctx.answerCallbackQuery({ text: 'Не удалось сохранить' });
    await ctx.editMessageText(`${draft.previewText}\n\n❌ Ошибка сохранения. Попробуй ещё раз.`);
  }
}

/** Нажатие «Отмена». */
export async function handleCancel(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (telegramId !== undefined) pending.delete(telegramId);
  await ctx.editMessageText('✖️ Отменено, ничего не сохранено.');
  await ctx.answerCallbackQuery();
}

/** Нажатие «Изменить» — просим прислать исправленный/дополненный текст. */
export async function handleEdit(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  await ctx.answerCallbackQuery();
  if (telegramId === undefined) return;

  const draft = pending.get(telegramId);
  const current = draft?.tx.raw_text ?? draft?.tx.description ?? '';
  await ctx.editMessageText(
    '✏️ Пришли новый текст операции.\n\n' +
      (current ? `Текущий текст:\n«${current}»\n\n` : '') +
      'Скопируй его, допиши или исправь и отправь — я переразберу.'
  );
}

export function cancelPending(telegramId: number): boolean {
  return pending.delete(telegramId);
}
function formatPreview(
  result: ParseResult,
  accounts: Account[],
  categories: Category[]
): string {
  const typeLabel =
    result.type === 'income' ? 'Доход' : result.type === 'adjustment' ? 'Корректировка' : 'Расход';
  const account = accounts.find((a) => a.id === result.accountId);
  const category = categories.find((c) => c.id === result.categoryId);
  const usdLine =
    result.currency === 'USD'
      ? `\n≈ ${formatMoney(convertToUah(result.amount, 'USD', 41.5), 'UAH')}`
      : '';

  const lines = [
    '🧾 Новая операция',
    `Тип: ${typeLabel}`,
    `Сумма: ${formatMoney(result.amount, result.currency)}${usdLine}`,
    account ? `Счёт: ${account.name}` : null,
    category ? `Категория: ${category.name}` : null,
    result.description ? `Описание: ${result.description}` : null,
    result.status === 'needs_review' ? '\n⚠️ Разбор неполный — проверь перед сохранением.' : null,
  ].filter(Boolean);

  return lines.join('\n');
}

