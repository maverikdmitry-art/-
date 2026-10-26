import {
  createServerClient,
  mapAccount,
  mapCategory,
  mapGoalContribution,
  mapRecurringPayment,
  mapSettings,
  mapTransaction,
  mapTransfer,
  mapUser,
  type SupabaseClientAny,
} from '@oover/shared';
import type { Account, AppSettings, Category, GoalContribution, NewTransaction, RecurringPayment, Transaction, Transfer, User } from '@oover/shared';
import { config } from './config';

/**
 * Доступ бота к Supabase (ROADMAP 1.2, 1.8).
 *
 * Клиент создаётся лениво при первом обращении к БД и переиспользуется дальше.
 * Если переменные Supabase не заданы, getSupabase() вернёт null — тогда вызывающий
 * код покажет пользователю понятное сообщение, а бот продолжит работать для
 * команд, не требующих БД (например, /start).
 *
 * Для бота используется service_role (серверный ключ), который обходит RLS.
 * Форма строки БД → типизированная модель берётся из общих мапперов @oover/shared.
 */

let client: SupabaseClientAny | null = null;

/** Возвращает клиент Supabase или null, если БД не сконфигурирована. */
export function getSupabase(): SupabaseClientAny | null {
  const url = config.SUPABASE_URL;
  const key = config.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  if (!client) {
    client = createServerClient(url, key);
  }
  return client;
}

/** Все счёта, отсортированные по sort_order. */
export async function fetchAccounts(supabase: SupabaseClientAny): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`Не удалось загрузить счета: ${error.message}`);
  return (data ?? []).map((row) => mapAccount(row as Record<string, unknown>));
}

/** Настройки приложения (курс USD и пр.) из таблицы settings. */
export async function fetchSettings(supabase: SupabaseClientAny): Promise<AppSettings> {
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) throw new Error(`Не удалось загрузить настройки: ${error.message}`);
  return mapSettings((data ?? []) as Array<{ key: string; value: string }>);
}

/** Все категории (нужны парсеру для сопоставления «кофе» → Кафе). */
export async function fetchCategories(supabase: SupabaseClientAny): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('id');
  if (error) throw new Error(`Не удалось загрузить категории: ${error.message}`);
  return (data ?? []).map((row) => mapCategory(row as Record<string, unknown>));
}

/** Пользователь по telegram_id. null — если не привязан (см. seed в schema.sql). */
export async function fetchUserByTelegramId(
  supabase: SupabaseClientAny,
  telegramId: number
): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')



    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (error) throw new Error(`Не удалось найти пользователя: ${error.message}`);
  return data ? mapUser(data as Record<string, unknown>) : null;
}

/**
 * Последний использованный счёт пользователя — чтобы парсер предлагал тот же счёт
 * по умолчанию («кофе 150» → последний карточный счёт).
 */
export async function fetchLastUsedAccountId(
  supabase: SupabaseClientAny,
  userId: number
): Promise<number | undefined> {
  const { data, error } = await supabase
    .from('transactions')
    .select('account_id')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return undefined;
  return Number((data[0] as Record<string, unknown>).account_id);
}

/**
 * Идемпотентная вставка транзакции. Одно и то же сообщение Telegram
 * (telegram_message_id) не создаст дубль — при повторе insert вернёт 0 строк.
 * Возвращает id созданной транзакции либо null, если это был дубль.
 */
export async function insertTransaction(
  supabase: SupabaseClientAny,
  tx: NewTransaction,
  telegramMessageId: number
): Promise<number | null> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      ...tx,
      telegram_message_id: telegramMessageId,
      source: 'bot',
    })
    .select('id')
    .maybeSingle();
  if (error) {
    // 23505 = unique_violation (uq_tx_telegram) → это повтор того же сообщения.
    if (error.code === '23505') return null;
    throw new Error(`Не удалось сохранить операцию: ${error.message}`);
  }
  const first = Array.isArray(data) ? (data[0] as Record<string, unknown>) : (data as Record<string, unknown>);

  if (!first || first.id === undefined || first.id === null) {
    console.error('[db.insertTransaction] insert returned no id:', data);
    return null;
  }
  return Number(first.id);
}

export async function fetchTransfers(supabase: SupabaseClientAny): Promise<Transfer[]> {
  const { data, error } = await supabase.from('transfers').select('*').order('occurred_at', { ascending: false });
  if (error) throw new Error(`Не удалось загрузить переводы: ${error.message}`);
  return (data ?? []).map((row) => mapTransfer(row as Record<string, unknown>));
}

export async function fetchGoalContributions(supabase: SupabaseClientAny): Promise<GoalContribution[]> {
  const { data, error } = await supabase.from('goal_contributions').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(`Не удалось загрузить взносы: ${error.message}`);
  return (data ?? []).map((row) => mapGoalContribution(row as Record<string, unknown>));
}

export async function fetchRecurring(supabase: SupabaseClientAny): Promise<RecurringPayment[]> {
  const { data, error } = await supabase.from('recurring_payments').select('*').order('id');
  if (error) throw new Error(`Не удалось загрузить регулярные платежи: ${error.message}`);
  return (data ?? []).map((row) => mapRecurringPayment(row as Record<string, unknown>));
}

export async function fetchTransactions(supabase: SupabaseClientAny): Promise<Transaction[]> {
  const { data, error } = await supabase.from('transactions').select('*').order('occurred_at', { ascending: false });
  if (error) throw new Error(`Не удалось загрузить операции: ${error.message}`);
  return (data ?? []).map((row) => mapTransaction(row as Record<string, unknown>));
}

