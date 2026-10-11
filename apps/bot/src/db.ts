import {
  createServerClient,
  mapAccount,
  mapSettings,
  type SupabaseClientAny,
} from '@oover/shared';
import type { Account, AppSettings } from '@oover/shared';
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

export type AccountBalance = {
  account: Account;
  /** Баланс в валюте счёта (с точностью до копеек). */
  balance: number;
};

