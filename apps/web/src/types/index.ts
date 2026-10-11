/**
 * Типы дашборда. Единственный источник правды — `@oover/shared`
 * (packages/shared/src/types.ts), совпадает со схемой БД (supabase/schema.sql).
 * Этот файл только реэкспортирует типы, чтобы не дублировать определения.
 */
export type {
  Account,
  AccountKind,
  AppSettings,
  AppStore,
  Category,
  CategoryGroup,
  CategoryType,
  Currency,
  Goal,
  GoalContribution,
  NewTransaction,
  RecurringPayment,
  RecurringType,
  Transaction,
  TransactionSource,
  TransactionStatus,
  TransactionType,
  Transfer,
  User,
} from '@oover/shared';

