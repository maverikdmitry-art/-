import { createBrowserClient, type SupabaseClientAny } from '@oover/shared';

export type { SupabaseClientAny };

/**
 * Клиент Supabase для веб-дашборда.
 *
 * В браузере допустим ТОЛЬКО публичный anon-ключ + RLS (см. PROJECT_RULES).
 * service_role-ключ сюда никогда не попадает.
 *
 * URL/ключ пробрасываются из корневого .env через `vite.config.ts`
 * (переменные SUPABASE_URL / SUPABASE_ANON_KEY). Дополнительно поддержаны
 * стандартные VITE_* имена, которые Vite экспонирует автоматически.
 */

const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

/** true, если Supabase сконфигурирован (есть URL и anon-ключ). */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

/** Возвращает браузерный клиент Supabase. Бросает понятную ошибку, если не сконфигурирован. */
export function getSupabase(): SupabaseClientAny {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase не сконфигурирован. Добавьте SUPABASE_URL и SUPABASE_ANON_KEY в корневой .env и перезапустите npm run dev:web.'
    );
  }
  return createBrowserClient(url, anonKey);
}
