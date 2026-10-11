import type { GoogleGenAI } from '@google/genai';
import type { Account, Category } from '../types';
import { parseWithRegex, type ParseResult } from './regex';
import { parseWithGemini } from '../gemini/parse';

export type { ParseResult, ParseStatus } from './regex';
export { parseWithRegex } from './regex';
export { parseWithGemini } from '../gemini/parse';

/** Необязательный LLM-слой. Если не передан — работает только regex. */
export type GeminiLayer = {
  client: GoogleGenAI;
  model: string;
};

export type ParseInput = {
  text: string;
  categories: Category[];
  accounts: Account[];
  lastUsedAccountId?: number;
  gemini?: GeminiLayer;
  /** Колбэк для логирования ошибок LLM (бот не должен молча терять сбой). */
  onLlmError?: (error: unknown) => void;
};

/**
 * Каскад парсинга (ARCHITECTURE.md 4.1): Gemini → regex → needs_review.
 * Бот НИКОГДА не теряет ввод: при любом сбое LLM срабатывает regex-фоллбэк.
 */
export async function parseInput(input: ParseInput): Promise<ParseResult> {
  const { text, categories, accounts, lastUsedAccountId, gemini, onLlmError } = input;

  if (gemini) {
    try {
      return await parseWithGemini(text, categories, accounts, {
        client: gemini.client,
        model: gemini.model,
        lastUsedAccountId,
      });
    } catch (error) {
      onLlmError?.(error);
    }
  }

  return parseWithRegex(text, categories, accounts, lastUsedAccountId);
}
