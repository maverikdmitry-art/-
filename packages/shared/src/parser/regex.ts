import type { Account, Category, Currency, TransactionType } from '../types';

/**
 * Regex-парсер — фоллбэк, который работает без интернета и без LLM.
 * Каскад ввода: Gemini → regex → status='needs_review' (бот не теряет ввод).
 */

export type ParseStatus = 'ok' | 'needs_review';

export type ParseResult = {
  type: TransactionType;
  amount: number;
  currency: Currency;
  categoryId?: number;
  accountId?: number;
  description: string;
  note?: string;
  status: ParseStatus;
  rawText: string;
  matchedKeyword?: string;
};

const INCOME_KEYWORDS = [
  'зп',
  'зарплата',
  'получка',
  'доход',
  'аванс',
  'выплата',
  'премия',
  'продал',
  'пришло',
  'пополнение',
  'гонорар',
  'фриланс',
  'кешбек',
  'кэшбэк',
];

/** Синонимы категорий: слово в тексте → имя категории в БД. */
export const CATEGORY_SYNONYMS: Record<string, string[]> = {
  Продукты: ['сильпо', 'атб', 'фора', 'ашан', 'еда', 'продукты', 'молоко', 'хлеб', 'мясо', 'супермаркет', 'рынок', 'новус', 'варус', 'бакалея'],
  Кафе: ['кофе', 'мак', 'макдональдс', 'ресторан', 'бар', 'ланч', 'обед', 'ужин', 'кафе', 'пицца', 'суши', 'kfc', 'бургер', 'десерт', 'чай'],
  Транспорт: ['такси', 'болт', 'убер', 'uber', 'bolt', 'метро', 'бензин', 'заправка', 'wog', 'okko', 'билет', 'проезд', 'парковка', 'маршрутка', 'поезд', 'укрзализныця'],
  Жильё: ['аренда', 'квартира', 'жилье', 'риелтор', 'найм'],
  Коммуналка: ['коммуналка', 'жкх', 'свет', 'газ', 'отопление', 'вода', 'квартплата', 'домофон'],
  Связь: ['связь', 'интернет', 'киевстар', 'водофон', 'лайф', 'телефон', 'kyivstar', 'vodafone', 'lifecell'],
  Развлечения: ['кино', 'боулинг', 'концерт', 'игра', 'steam', 'билеты', 'театр', 'клуб', 'музей', 'отдых'],
  Покупки: ['одежда', 'обувь', 'zara', 'розетка', 'rozetka', 'покупка', 'вещи', 'техника', 'джинсы', 'куртка', 'электроника'],
  Подписки: ['подписка', 'spotify', 'youtube', 'netflix', 'icloud', 'chatgpt', 'apple', 'подписки'],
  Зарплата: ['зп', 'зарплата', 'получка', 'аванс', 'фриланс', 'гонорар'],
  'Прочий доход': ['кэшбэк', 'кешбек', 'проценты', 'дивиденды', 'подарок'],
};

const USD_MARKERS = ['usd', '$', 'доллар', 'долларов', 'бакс', 'баксов'];

/** Вытаскивает первую похожую на сумму величину из текста. */
function extractAmount(text: string): number {
  // Нормализуем десятичную запятую: «150,50» → «150.50»
  const normalized = text.replace(/(\d+),(\d{1,2})(?!\d)/g, '$1.$2');
  const matches = normalized.match(/\b\d+(?:\.\d{1,2})?\b/g);
  if (!matches) return 0;

  const candidates = matches
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  // Берём наибольшее правдоподобное число (обычно сумма заметнее прочих чисел)
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

function detectCurrency(text: string): Currency {
  const lower = text.toLowerCase();
  return USD_MARKERS.some((marker) => lower.includes(marker)) ? 'USD' : 'UAH';
}

function detectType(text: string): { type: TransactionType; matchedKeyword?: string } {
  const lower = text.toLowerCase();
  for (const keyword of INCOME_KEYWORDS) {
    if (new RegExp(`(^|\\s)${keyword}(\\s|$)`, 'i').test(lower)) {
      return { type: 'income', matchedKeyword: keyword };
    }
  }
  return { type: 'expense' };
}

function matchCategory(text: string, categories: Category[]): number | undefined {
  const lower = text.toLowerCase();
  for (const [categoryName, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (synonyms.some((synonym) => lower.includes(synonym))) {
      const found = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
      if (found) return found.id;
    }
  }
  return undefined;
}

function matchAccount(
  text: string,
  accounts: Account[],
  currency: Currency,
  lastUsedAccountId?: number
): number | undefined {
  const lower = text.toLowerCase();
  const findByName = (needle: string) =>
    accounts.find((a) => a.name.toLowerCase().includes(needle));

  if (lower.includes('моно')) return findByName('моно')?.id;
  if (lower.includes('райф') || lower.includes('аваль')) return findByName('райф')?.id;
  if (lower.includes('нал') || lower.includes('кэш') || lower.includes('cash')) {
    return accounts.find((a) => a.kind === 'cash' && a.currency === currency)?.id;
  }

  if (lastUsedAccountId && accounts.some((a) => a.id === lastUsedAccountId && a.currency === currency)) {
    return lastUsedAccountId;
  }
  return (accounts.find((a) => a.is_active && a.currency === currency) || accounts[0])?.id;
}

function buildDescription(text: string, amount: number, type: TransactionType): string {
  let description = text;
  if (amount > 0) {
    description = description.replace(new RegExp(`\\b${amount}\\b`, 'g'), '');
  }
  description = description.replace(/^(доход|расход|трата|чек|купил|оплатил|получил)\s+/i, '').trim();
  if (!description) {
    return type === 'income' ? 'Поступление средств' : 'Оплата';
  }
  return description.charAt(0).toUpperCase() + description.slice(1);
}

/** Главная функция regex-парсера. */
export function parseWithRegex(
  rawText: string,
  categories: Category[],
  accounts: Account[],
  lastUsedAccountId?: number
): ParseResult {
  const text = rawText.trim();
  const amount = extractAmount(text);
  const currency = detectCurrency(text);
  const { type, matchedKeyword } = detectType(text);

  let categoryId = matchCategory(text, categories);
  if (!categoryId) {
    if (type === 'income') {
      categoryId = categories.find((c) => c.type === 'income')?.id;
    } else {
      categoryId = categories.find((c) => c.name.toLowerCase() === 'прочее')?.id;
    }
  }

  const accountId = matchAccount(text, accounts, currency, lastUsedAccountId);

  return {
    type,
    amount,
    currency,
    categoryId,
    accountId,
    description: buildDescription(text, amount, type),
    note: rawText,
    status: amount > 0 ? 'ok' : 'needs_review',
    rawText,
    matchedKeyword,
  };
}
