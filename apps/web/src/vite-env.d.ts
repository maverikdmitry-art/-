/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL проекта Supabase (пробрасывается из корневого .env через vite.config). */
  readonly SUPABASE_URL: string;
  /** Публичный anon-ключ Supabase (единственный ключ, допустимый в браузере). */
  readonly SUPABASE_ANON_KEY: string;
  /** Альтернативные VITE-имена (Vite автоматически экспонирует VITE_* из .env). */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
