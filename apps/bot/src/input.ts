import { Context, InlineKeyboard } from 'grammy';
import { convertToUah, formatMoney, parseInput, type ParseResult } from '@oover/shared';
import type { Account, Category, NewTransaction } from '@oover/shared';
import {
  fetchAccounts,
  fetchCategories,
  fetchLastUsedAccountId,
  fetchUserByTelegramId,
  getSupabase,
  insertTransaction,
} from './db';
import {
  checkAndSendOverspendAlert,
  calculateRemainingLimitPct,
  sendPartnerExpenseNotification,
  spenderNameFromCtx,
} from './notifications';

/**
 * Ввод трат из Telegram (ROADMAP 1.8).
 *
 * Сценарий: пользователь пишет «кофе 150 мак» → parseInput (регулярные выражения) →
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

/** Обработка текстового сообщения: разбор и показ превью. */
export async function handleText(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (telegramId !== undefined && hasRecurringPending(telegramId)) {
    await handleRecurringStep(ctx);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    await ctx.reply('⚠️ База данных не подключена. Проверь SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.');
    return;
  }

  const text = ctx.message?.text;
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

    const result: ParseResult = await parseInput({
      text,
      categories,
      accounts,
      lastUsedAccountId,
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

    // Уведомления партнёру и алерт о перерасходе — только для расходов.
    if (draft.tx.type === 'expense') {
      const spenderName = spenderNameFromCtx(ctx);
      await sendPartnerExpenseNotification(ctx, telegramId, spenderName, {
        amount: draft.tx.amount,
        currency: draft.tx.currency,
        description: draft.tx.description,
        account_id: draft.tx.account_id,
      });

      const limit = await calculateRemainingLimitPct(supabase, telegramId);
      if (limit?.isAlert) {
        await checkAndSendOverspendAlert(ctx, telegramId, limit.pct);
      }
    }
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



type RecurringDraft = {
  name?: string;
  amount?: number;
  account_id?: number;
  day_of_month?: number;
  type?: 'income' | 'expense';
};
type RecurringState = { step: 'name' | 'amount' | 'account' | 'day' | 'type' | 'preview'; draft: RecurringDraft; accounts: { id: number; name: string }[] };
const pendingRecurring = new Map<number, RecurringState>();

export function startRecurringDialog(ctx: Context, accounts: { id: number; name: string }[]): void {
  const telegramId = ctx.from?.id;
  if (telegramId === undefined) return;
  pendingRecurring.set(telegramId, { step: 'name', draft: {}, accounts });
  ctx.reply('Название платежа? (например: Интернет)');
}

export function hasRecurringPending(telegramId: number): boolean {
  return pendingRecurring.has(telegramId);
}

export async function handleRecurringStep(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (telegramId === undefined) return;
  const state = pendingRecurring.get(telegramId);
  if (!state) return;
  const text = ctx.message?.text?.trim();
  if (!text) return;

  if (state.step === 'name') {
    state.draft.name = text;
    state.step = 'amount';
    await ctx.reply('Сумма? (например: 300)');
    return;
  }
  if (state.step === 'amount') {
    const num = Number(text.replace(',', '.'));
    if (!num || num <= 0) { await ctx.reply('Введите число больше 0.'); return; }
    state.draft.amount = num;
    state.step = 'account';
    const list = state.accounts.map((a, i) => `${i + 1} — ${a.name}`).join('\n');
    await ctx.reply(`Счёт? Введи номер:\n${list}`);
    return;
  }
  if (state.step === 'account') {
    const idx = Number(text) - 1;
    if (isNaN(idx) || idx < 0 || idx >= state.accounts.length) {
      await ctx.reply('Неверный номер. Попробуй ещё раз.');
      return;
    }
    state.draft.account_id = state.accounts[idx].id;
    state.step = 'day';
    await ctx.reply('День месяца (1–31)?');
    return;
  }
  if (state.step === 'day') {
    const day = Number(text);
    if (isNaN(day) || day < 1 || day > 31) { await ctx.reply('Введите число от 1 до 31.'); return; }
    state.draft.day_of_month = day;
    state.step = 'type';
    await ctx.reply('Тип операции: доход или расход?');
    return;
  }
  if (state.step === 'type') {
    const t = text.toLowerCase();
    let type: 'income' | 'expense' | null = null;
    if (t.includes('доход') || t === 'income') type = 'income';
    else if (t.includes('расход') || t === 'expense') type = 'expense';
    if (!type) { await ctx.reply('Введите «доход» или «расход».'); return; }
    state.draft.type = type;
    state.step = 'preview';
    console.log('[recurring] state after type:', state.step, state.draft);
    const d = state.draft;
    const acc = state.accounts.find(a => a.id === d.account_id)?.name;
    const { InlineKeyboard } = await import('grammy');
    const kb = new InlineKeyboard().text('✅ Сохранить', 'rec:save').row().text('✖️ Отмена', 'rec:cancel');
    await ctx.reply(
      `🧾 Новый регулярный платёж\n` +
        `Название: ${d.name}\n` +
        `Сумма: ${d.amount}\n` +
        `Счёт: ${acc}\n` +
        `День: ${d.day_of_month}\n` +
        `Тип: ${d.type}\n\n` +
        'Нажми кнопку «Сохранить» или «Отмена».',
      { reply_markup: kb }
    );
    return;
  }
}

export async function handleRecurringSave(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (telegramId === undefined) return;
  const state = pendingRecurring.get(telegramId);
  console.log('[recurring save] telegramId:', telegramId, 'state:', state?.step);
  if (!state || state.step !== 'preview') {
    await ctx.answerCallbackQuery({ text: 'Нет данных' });
    return;
  }
  pendingRecurring.delete(telegramId);
  const supabase = getSupabase();
  if (!supabase) {
    await ctx.answerCallbackQuery({ text: 'БД недоступна' });
    return;
  }
  try {
    const user = await fetchUserByTelegramId(supabase, telegramId);
    if (!user) {
      await ctx.answerCallbackQuery({ text: 'Пользователь не найден' });
      return;
    }
    const d = state.draft;
    const today = new Date();
    const nextDue = new Date(today.getFullYear(), today.getMonth() + 1, d.day_of_month!).toISOString().slice(0, 10);
    const { insertRecurring } = await import('./db');
    await insertRecurring(supabase, {
      name: d.name!,
      amount: d.amount!,
      currency: 'UAH',
      account_id: d.account_id!,
      category_id: null,
      user_id: user.id,
      day_of_month: d.day_of_month!,
      type: d.type!,
      is_active: true,
      next_due: nextDue,
    });
    await ctx.editMessageText('✅ Регулярный платёж сохранён.');
    await ctx.answerCallbackQuery();
  } catch (err) {
    console.error('[recurring save] ошибка:', err instanceof Error ? err.message : err);
    await ctx.answerCallbackQuery({ text: 'Ошибка сохранения' });
  }
}

export function cancelRecurring(telegramId: number): boolean {
  return pendingRecurring.delete(telegramId);
}
