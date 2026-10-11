/**
 * Формулы дашборда. Единственный источник правды — `@oover/shared`
 * (packages/shared/src/calculations.ts + money.ts), где деньги считаются
 * через decimal.js, а «сутки» — по Europe/Kyiv. UI сам деньги не считает.
 *
 * Этот файл — тонкий реэкспорт: вся логика живёт в `@oover/shared`,
 * поэтому дашборд и бот считают балансы, Net Worth и Safe-to-spend одинаково.
 */
export {
  calculateAccountBalance,
  calculateMonthComparison,
  calculateNetWorth,
  calculateSafeToSpend,
  formatMoney,
  pendingRecurring,
} from '@oover/shared';
export type {
  MonthComparisonResult,
  NetWorthResult,
  SafeToSpendResult,
} from '@oover/shared';
