import { Context } from 'grammy';
import { convertToUah, formatMoney, calculateSafeToSpend } from '@oover/shared';
import {
  fetchAccounts,
  fetchGoalContributions,
  fetchRecurring,
  fetchSettings,
  fetchTransactions,
  fetchTransfers,
  fetchUserByTelegramId,
  getSupabase,
} from './db';

/**
 * Уведомления партнёру (ROADMAP 3.1–3.2).
 *
 * Взаимные уведомления о расходах: когда один партнёр сохраняет трату,
 * другому приходит сообщение от бота. Также алерт о перерасходе дневного лимита.
 *
 * Переключатель вкл/выкл пока в памяти процесса (Map). При перезапуске бота
 * сбрасывается в true. Если понадобится сохранение — перенести в таблицу users
 * (поле notify_partner уже есть).
 */

// telegramId → partner telegramId
const PARTNER_MAP: Record<number, number> = {
  396881223: 725733059, // Дима → Даша
  725733059: 396881223, // Даша → Дима
};

// telegramId → уведомления включены (true = по умолчанию)
const notificationsEnabled = new Map<number, boolean>([
  [396881223, true],
  [725733059, true],
]);

/** ID партнёра по telegramId пользователя. null — если нет пары. */
export function getPartnerId(telegramId: number): number | null {
  return PARTNER_MAP[telegramId] ?? null;
}

/** Включены ли уведомления для пользователя. */
export function isNotificationsEnabled(telegramId: number): boolean {
  return notificationsEnabled.get(telegramId) ?? true;
}

/** Переключить уведомления для пользователя. Возвращает новое состояние. */
export function toggleNotifications(telegramId: number): boolean {
  const current = notificationsEnabled.get(telegramId) ?? true;
  const next = !current;
  notificationsEnabled.set(telegramId, next);
  return next;
}

/** Форматирует текст уведомления о расходе. */
export function formatExpenseText(
  spenderName: string,
  tx: {
    amount: number;
    currency: 'UAH' | 'USD';
    description: string | null;
    account_name: string | null;
  }
): string {
  const usdLine =
    tx.currency === 'USD'
      ? `\n≈ ${formatMoney(convertToUah(tx.amount, 'USD', 41.5), 'UAH')}`
      : '';
  return (
    `💸 ${spenderName} потратил ${formatMoney(tx.amount, tx.currency)}${usdLine}\n` +
    (tx.description ? `Описание: ${tx.description}\n` : '') +
    (tx.account_name ? `Счёт: ${tx.account_name}` : '')
  );
}

/** Имя пользователя по telegramId (из from). */
export function spenderNameFromCtx(ctx: Context): string {
  return ctx.from?.first_name ?? ctx.from?.username ?? 'Пользователь';
}

/**
 * Отправляет партнёру уведомление о расходе.
 * Вызывается после успешного сохранения транзакции типа 'expense'.
 */
export async function sendPartnerExpenseNotification(
  ctx: Context,
  spenderId: number,
  spenderName: string,
  transaction: {
    amount: number;
    currency: 'UAH' | 'USD';
    description: string | null;
    account_id: number | null;
  }
): Promise<void> {
  const partnerId = getPartnerId(spenderId);
  if (!partnerId) return;
  if (!isNotificationsEnabled(partnerId)) return;

  let accountName: string | null = null;
  if (transaction.account_id) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const accounts = await fetchAccounts(supabase);
        const acc = accounts.find((a) => a.id === transaction.account_id);
        accountName = acc?.name ?? null;
      } catch (err) {
        console.error('[notify] fetch account name error:', err);
      }
    }
  }

  const text = formatExpenseText(spenderName, {
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description,
    account_name: accountName,
  });

  try {
    await ctx.api.sendMessage(partnerId, text);
  } catch (err) {
    console.error('[notify] partner notification error:', err);
  }
}

/**
 * Проверяет дневной лимит и шлёт алерт о перерасходе тому, кто тратит.
 * Принимает готовый remainingLimitPct — не пересчитывает формулу внутри.
 */
export async function checkAndSendOverspendAlert(
  ctx: Context,
  telegramId: number,
  remainingLimitPct: number
): Promise<void> {
  if (!isNotificationsEnabled(telegramId)) return;

  try {
    await ctx.api.sendMessage(
      telegramId,
      `⚠️ Превышение дневного лимита!\nОсталось менее ${Math.round(remainingLimitPct)}% от дневного лимита.`
    );
  } catch (err) {
    console.error('[notify] overspend alert error:', err);
  }
}

/**
 * Пересчитывает safe-to-spend и возвращает оставшийся процент лимита.
 * Вынесено отдельно, чтобы формула была в одном месте.
 */
export async function calculateRemainingLimitPct(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  telegramId: number
): Promise<{ pct: number; isAlert: boolean } | null> {
  if (!supabase) return null;
  const user = await fetchUserByTelegramId(supabase, telegramId);
  if (!user) return null;

  const [accounts, transactions, transfers, contributions, recurring, settings] =
    await Promise.all([
      fetchAccounts(supabase),
      fetchTransactions(supabase),
      fetchTransfers(supabase),
      fetchGoalContributions(supabase),
      fetchRecurring(supabase),
      fetchSettings(supabase),
    ]);

  const safe = calculateSafeToSpend(accounts, transactions, transfers, contributions, recurring, settings);

  return {
    pct: safe.pctSpentToday,
    isAlert: safe.isAlert,
  };
}

/** Команда /notify — включить/выключить уведомления для себя. */
export async function handleNotifyCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (telegramId === undefined) return;

  const next = toggleNotifications(telegramId);
  await ctx.reply(
    next
      ? '✅ Уведомления о тратах партнёра включены.'
      : '✖️ Уведомления о тратах партнёра выключены.'
  );
}