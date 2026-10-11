import { parseWithRegex } from '@oover/shared';
import type { Account, Category } from '../types';

/**
 * Парсер ввода для дашборда. Вся логика живёт в `@oover/shared`
 * (packages/shared/src/parser/regex.ts) — здесь только тонкая обёртка,
 * чтобы дашборд и бот разбирали фразы одинаково.
 *
 * Gemini-слой (`parseInput` из shared) в браузер не подключается:
 * ключ GEMINI_API_KEY в бандл попадать не должен (см. vite.config.ts).
 */
export type { ParseResult } from '@oover/shared';

export function parseFinancialInput(
  rawText: string,
  categories: Category[],
  accounts: Account[],
  lastUsedAccountId?: number
) {
  return parseWithRegex(rawText, categories, accounts, lastUsedAccountId);
}

