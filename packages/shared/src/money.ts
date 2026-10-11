import Decimal from 'decimal.js';

/**
 * Денежные операции БЕЗ плавающей точки.
 * По PROJECT_RULES деньги нельзя считать через float (`0.1 + 0.2 !== 0.3`),
 * поэтому все суммы проходят через decimal.js и округляются до копеек (2 знака).
 * В базе деньги хранятся как numeric(14,2).
 */

// Достаточно 2 знаков после запятой; запас точности для промежуточных операций.
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const MONEY_SCALE = 2;

/** Безопасно превращает число/строку/Decimal в Decimal. */
export function toDecimal(value: number | string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Округляет до 2 знаков и возвращает обычное число (для UI и JSON). */
export function round2(value: number | string | Decimal): number {
  return toDecimal(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP).toNumber();
}

/** Сумма списка сумм без накопления ошибки округления. */
export function sumMoney(values: Array<number | string | Decimal>): number {
  let acc = new Decimal(0);
  for (const value of values) {
    acc = acc.plus(toDecimal(value));
  }
  return round2(acc);
}

/**
 * Переводит сумму в UAH.
 * USD → UAH умножается на ручной курс из settings.usd_rate.
 */
export function convertToUah(
  amount: number | string | Decimal,
  currency: 'UAH' | 'USD',
  usdRate: number
): number {
  const value = toDecimal(amount);
  if (currency === 'USD') {
    return round2(value.times(toDecimal(usdRate)));
  }
  return round2(value);
}

/**
 * Форматирует деньги с символом валюты.
 * UAH → «1 234,50 ₴», USD → «1 234,50 $».
 */
export function formatMoney(amount: number | string | Decimal, currency: string = 'UAH'): string {
  const rounded = round2(amount);
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  const symbol = currency === 'USD' ? '$' : '₴';
  return `${formatted} ${symbol}`;
}
