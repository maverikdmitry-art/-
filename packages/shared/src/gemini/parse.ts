import { Type, type GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { Account, Category } from '../types';
import type { ParseResult, ParseStatus } from '../parser/regex';

/**
 * LLM-парсер на Gemini (ARCHITECTURE.md 4.1).
 * Возвращает структуру из свободного текста («кофе 150 мак» → расход 150 UAH, категория Кафе).
 * На любой ошибке бросает исключение — вызывающий код обязан поймать и откатиться на regex.
 */

const CONFIDENCE_THRESHOLD = 0.5;

/** OpenAPI-схема ответа, которую обязан вернуть Gemini. */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ['expense', 'income', 'adjustment'],
      description: 'Доход (income), расход (expense) или корректировка (adjustment).',
    },
    amount: { type: Type.NUMBER, description: 'Сумма операции, положительное число.' },
    currency: {
      type: Type.STRING,
      enum: ['UAH', 'USD'],
      description: 'Валюта. По умолчанию UAH.',
    },
    category: {
      type: Type.STRING,
      nullable: true,
      description: 'Точное имя категории из списка или null.',
    },
    account: {
      type: Type.STRING,
      nullable: true,
      description: 'Точное имя счёта из списка или null.',
    },
    description: { type: Type.STRING, description: 'Короткое описание операции.' },
    confidence: { type: Type.NUMBER, description: 'Уверенность распознавания от 0 до 1.' },
  },
  required: ['type', 'amount', 'currency', 'description'],
};

/** Схема валидации ответа модели. */
const geminiResponseSchema = z.object({
  type: z.enum(['expense', 'income', 'adjustment']),
  amount: z.coerce.number().nonnegative(),
  currency: z.enum(['UAH', 'USD']).default('UAH'),
  category: z.string().nullish(),
  account: z.string().nullish(),
  description: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export type GeminiParseOptions = {
  client: GoogleGenAI;
  model: string;
  lastUsedAccountId?: number;
};

function buildPrompt(text: string, categories: Category[], accounts: Account[]): string {
  const categoryList = categories
    .filter((c) => c.is_active)
    .map((c) => `- ${c.name} (${c.type === 'income' ? 'доход' : 'расход'})`)
    .join('\n');
  const accountList = accounts
    .map((a) => `- ${a.name} (${a.currency}, ${a.kind === 'cash' ? 'наличные' : 'карта'})`)
    .join('\n');

  return [
    'Ты — парсер личных финансов. Извлеки из сообщения пользователя одну операцию.',
    'Правила:',
    '1. type: income — если это доход (зарплата, аванс, кэшбэк, поступление); иначе expense.',
    '2. amount — только число, положительное. Десятичный разделитель — точка.',
    '3. currency: USD, если упомянуты доллары/$/баксы, иначе UAH.',
    '4. category — выбери РОВНО одно имя из списка категорий или null.',
    '5. account — выбери РОВНО одно имя из списка счетов или null.',
    '6. description — краткое человеческое описание.',
    '',
    'Список категорий:',
    categoryList || '(пусто)',
    '',
    'Список счетов:',
    accountList || '(пусто)',
    '',
    `Сообщение: "${text}"`,
  ].join('\n');
}

function findByName<T extends { name: string }>(
  items: T[],
  name: string | null | undefined
): T | undefined {
  if (!name) return undefined;
  const needle = name.trim().toLowerCase();
  return items.find((item) => item.name.trim().toLowerCase() === needle);
}

function mapToParseResult(
  parsed: z.infer<typeof geminiResponseSchema>,
  rawText: string,
  categories: Category[],
  accounts: Account[],
  lastUsedAccountId?: number
): ParseResult {
  const category = findByName(categories, parsed.category);
  const account = findByName(accounts, parsed.account);

  const fallbackAccountId =
    lastUsedAccountId && accounts.some((a) => a.id === lastUsedAccountId && a.currency === parsed.currency)
      ? lastUsedAccountId
      : (accounts.find((a) => a.is_active && a.currency === parsed.currency) || accounts[0])?.id;

  const fallbackCategoryId =
    parsed.type === 'income'
      ? categories.find((c) => c.type === 'income')?.id
      : categories.find((c) => c.name.toLowerCase() === 'прочее')?.id;

  const isConfident = (parsed.confidence ?? 1) >= CONFIDENCE_THRESHOLD;
  const status: ParseStatus = parsed.amount > 0 && isConfident ? 'ok' : 'needs_review';

  return {
    type: parsed.type,
    amount: parsed.amount,
    currency: parsed.currency,
    categoryId: category?.id ?? fallbackCategoryId,
    accountId: account?.id ?? fallbackAccountId,
    description: parsed.description,
    note: rawText,
    status,
    rawText,
  };
}

/** Распознать текст через Gemini. Бросает исключение при сбое — вызывающий код делает фоллбэк. */
export async function parseWithGemini(
  rawText: string,
  categories: Category[],
  accounts: Account[],
  options: GeminiParseOptions
): Promise<ParseResult> {
  const response = await options.client.models.generateContent({
    model: options.model,
    contents: buildPrompt(rawText, categories, accounts),
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini вернул пустой ответ');
  }

  const validated = geminiResponseSchema.parse(JSON.parse(text));
  return mapToParseResult(validated, rawText, categories, accounts, options.lastUsedAccountId);
}
