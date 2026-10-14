import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Конфигурация бота OoverrFinancee.
 *
 * Секреты и настройки лежат в КОРНЕВОМ .env (шаблон — .env.example, в git не попадает).
 * dotenv по умолчанию ищет .env в текущей рабочей директории, поэтому указываем
 * абсолютный путь до корня монорепозитория — независимо от того, откуда запущен бот
 * (`npm run dev:bot` из корня или `tsx src/index.ts` из apps/bot).
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// config.ts лежит в apps/bot/src → поднимаемся на 3 уровня до корня монорепозитория.
const repoRoot = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(repoRoot, '.env') });

/** Строка ID через запятую ("123,456") → массив чисел. */
function parseTelegramIds(raw: string): number[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part));
}

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z
    .string({ error: 'TELEGRAM_BOT_TOKEN не задан в .env' })
    .min(1, 'TELEGRAM_BOT_TOKEN не может быть пустым'),
  ALLOWED_TELEGRAM_IDS: z
    .string({ error: 'ALLOWED_TELEGRAM_IDS не задан в .env' })
    .transform(parseTelegramIds)
    .pipe(
      z
        .array(z.number().int().positive())
        .min(1, 'ALLOWED_TELEGRAM_IDS должен содержать хотя бы один ID')
    ),
  LOG_LEVEL: z.string().default('info'),
  TZ: z.string().default('Europe/Kyiv'),
  // Supabase — опционально. Бот должен запускаться и без БД (тогда /balance подскажет,
  // что подключение не настроено). Фоллбэки: VITE_SUPABASE_URL (общий .env с дашборда)
  // или SUPABASE_URL; для бота приоритетно service_role, иначе anon.
  SUPABASE_URL: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Gemini — опционально. Если ключ задан, парсер использует LLM (умный разбор),
  // иначе работает regex-фоллбэк (простой разбор по ключевым словам).
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
});

export type BotConfig = z.infer<typeof envSchema>;

/**
 * Читает и валидирует переменные окружения. При ошибке бросает исключение
 * с понятным текстом — бот не должен молча запускаться с неверной конфигурацией.
 */
export function loadConfig(): BotConfig {
  const result = envSchema.safeParse({
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    ALLOWED_TELEGRAM_IDS: process.env.ALLOWED_TELEGRAM_IDS,
    LOG_LEVEL: process.env.LOG_LEVEL,
    TZ: process.env.TZ,
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  });
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(корень)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Неверная конфигурация (.env):\n${details}`);
  }
  return result.data;
}

/**
 * Готовая конфигурация, загруженная из корневого .env при импорте модуля.
 * Используется модулями доступа к БД и хендлерами.
 */
export const config = loadConfig();
