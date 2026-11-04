import { parseWithRegex } from '@oover/shared';
import type { Account, Category } from '../types';

/**
 * Парсер ввода для дашборда. Вся логика живёт в `@oover/shared`
 * (packages/shared/src/parser/regex.ts) — здесь только тонкая обёртка,
 * чтобы дашборд и бот разбирали фразы одинаково.
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

