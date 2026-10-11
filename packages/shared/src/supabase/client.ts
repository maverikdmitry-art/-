import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Фабрики клиентов Supabase.
 *  - Браузер (дашборд): использует публичный anon-ключ + RLS.
 *  - Сервер (бот): использует service_role-ключ, обходит RLS.
 * service_role НИКОГДА не попадает в браузер.
 */

export type SupabaseClientAny = SupabaseClient;

/** Клиент для веб-дашборда (публичный anon-ключ). */
export function createBrowserClient(url: string, anonKey: string): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL или SUPABASE_ANON_KEY не заданы');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

/** Клиент для серверных задач (бот): полный доступ через service_role. */
export function createServerClient(url: string, serviceRoleKey: string): SupabaseClient {
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY не заданы');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Database = Record<string, unknown>;
