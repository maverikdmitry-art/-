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
const repoRoot = path.resolve(__dirname, '../..');
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
    .string({ required_error: 'TELEGRAM_BOT_TOKEN не задан в .env' })
    .min(1, 'TELEGRAM_BOT_TOKEN не может быть пустым'),
  ALLOWED_TELEGRAM_IDS: z
    .string({ required_error: 'ALLOWED_TELEGRAM_IDS не задан в .env' })
    .transform(parseTelegramIds, { message: 'ALLOWED_TELEGRAM_IDS должен быть списком чисел' })
    .pipe(
      z
        .array(z.number().int().positive())
        .min(1, 'ALLOWED_TELEGRAM_IDS должен содержать хотя бы один ID')
    ),
  LOG_LEVEL: z.string().default('info'),
  TZ: z.string().default('Europe/Kyiv'),
});

export type BotConfig = z.infer<typeof envSchema>;

/**
 * Читает и валидирует переменные окружения. При ошибке бросает исключение
 * с понятным текстом — бот не должен молча запускаться с неверной конфигурацией.
 */
export function loadConfig(): BotConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(корень)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Неверная конфигурация (.env):\n${details}`);
  }
  return result.data;
}
