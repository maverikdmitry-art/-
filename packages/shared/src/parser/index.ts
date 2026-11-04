import type { Account, Category } from '../types';
import { parseWithRegex, type ParseResult } from './regex';

export type { ParseResult, ParseStatus } from './regex';
export { parseWithRegex } from './regex';

export type ParseInput = {
  text: string;
  categories: Category[];
  accounts: Account[];
  lastUsedAccountId?: number;
};

/**
 * Парсинг ввода: только regex (офлайн, без интернета).
 */
export async function parseInput(input: ParseInput): Promise<ParseResult> {
  const { text, categories, accounts, lastUsedAccountId } = input;
  return parseWithRegex(text, categories, accounts, lastUsedAccountId);
}
