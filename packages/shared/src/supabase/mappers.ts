import type {
  Account,
  AccountKind,
  AppSettings,
  Category,
  CategoryGroup,
  CategoryType,
  Currency,
  Goal,
  GoalContribution,
  RecurringPayment,
  RecurringType,
  Transaction,
  TransactionSource,
  TransactionStatus,
  TransactionType,
  Transfer,
  User,
} from '../types';
import { DEFAULT_TIMEZONE } from '../time';

/**
 * Supabase/PostgREST возвращает колонки numeric как СТРОКИ (чтобы не терять точность).
 * Эти мапперы приводят строки БД к типизированным моделям с обычными числами.
 * Используются и веб-дашбордом, и ботом — поэтому живут в shared.
 */

type Row = Record<string, unknown>;

export function num(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function intOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function strOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

export function str(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function mapUser(row: Row): User {
  return {
    id: num(row.id),
    name: str(row.name),
    telegram_id: num(row.telegram_id),
    notify_partner: bool(row.notify_partner, true),
  };
}

export function mapAccount(row: Row): Account {
  return {
    id: num(row.id),
    name: str(row.name),
    kind: (str(row.kind, 'card') as AccountKind),
    currency: (str(row.currency, 'UAH') as Currency),
    initial_balance: num(row.initial_balance),
    is_active: bool(row.is_active, true),
    sort_order: num(row.sort_order),
  };
}

export function mapCategoryGroup(row: Row): CategoryGroup {
  return {
    id: num(row.id),
    name: str(row.name),
    sort_order: num(row.sort_order),
  };
}

export function mapCategory(row: Row): Category {
  return {
    id: num(row.id),
    name: str(row.name),
    group_id: intOrNull(row.group_id),
    type: (str(row.type, 'expense') as CategoryType),
    is_active: bool(row.is_active, true),
  };
}

export function mapTransaction(row: Row): Transaction {
  return {
    id: num(row.id),
    type: (str(row.type, 'expense') as TransactionType),
    amount: num(row.amount),
    currency: (str(row.currency, 'UAH') as Currency),
    account_id: num(row.account_id),
    category_id: intOrNull(row.category_id),
    user_id: num(row.user_id),
    description: strOrNull(row.description),
    note: strOrNull(row.note),
    occurred_at: str(row.occurred_at),
    status: (str(row.status, 'ok') as TransactionStatus),
    source: (str(row.source, 'dashboard') as TransactionSource),
    raw_text: strOrNull(row.raw_text),
    telegram_chat_id: intOrNull(row.telegram_chat_id),
    telegram_message_id: intOrNull(row.telegram_message_id),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

export function mapTransfer(row: Row): Transfer {
  return {
    id: num(row.id),
    from_account_id: num(row.from_account_id),
    to_account_id: num(row.to_account_id),
    amount_from: num(row.amount_from),
    amount_to: num(row.amount_to),
    user_id: num(row.user_id),
    note: strOrNull(row.note),
    occurred_at: str(row.occurred_at),
  };
}

export function mapGoal(row: Row): Goal {
  return {
    id: num(row.id),
    name: str(row.name),
    target_amount: num(row.target_amount),
    currency: (str(row.currency, 'UAH') as Currency),
    is_active: bool(row.is_active, true),
    created_at: str(row.created_at),
  };
}

export function mapGoalContribution(row: Row): GoalContribution {
  return {
    id: num(row.id),
    goal_id: num(row.goal_id),
    amount: num(row.amount),
    user_id: intOrNull(row.user_id),
    created_at: str(row.created_at),
  };
}

export function mapRecurringPayment(row: Row): RecurringPayment {
  return {
    id: num(row.id),
    name: str(row.name),
    amount: num(row.amount),
    currency: (str(row.currency, 'UAH') as Currency),
    account_id: intOrNull(row.account_id),
    category_id: intOrNull(row.category_id),
    day_of_month: num(row.day_of_month),
    auto_confirm: bool(row.auto_confirm),
    next_due: str(row.next_due),
    is_active: bool(row.is_active, true),
    type: (str(row.type, 'expense') as RecurringType),
  };
}

/** Таблица settings — пары key/value. Обратно собираем в AppSettings. */
export function mapSettings(rows: Array<{ key: string; value: string }>): AppSettings {
  const dict = new Map<string, string>();
  for (const row of rows) {
    dict.set(row.key, row.value);
  }
  return {
    usd_rate: num(dict.get('usd_rate')) || 41.5,
    confirm_enabled: dict.get('confirm_enabled') !== 'false',
    next_income_date: dict.get('next_income_date') ?? '',
    overspend_alert_pct: num(dict.get('overspend_alert_pct')) || 30,
    timezone: dict.get('timezone') ?? DEFAULT_TIMEZONE,
  };
}

/** Разбирает AppSettings обратно в массив пар key/value для записи в БД. */
export function settingsToRows(settings: AppSettings): Array<{ key: string; value: string }> {
  return [
    { key: 'usd_rate', value: String(settings.usd_rate) },
    { key: 'confirm_enabled', value: String(settings.confirm_enabled) },
    { key: 'next_income_date', value: settings.next_income_date ?? '' },
    { key: 'overspend_alert_pct', value: String(settings.overspend_alert_pct) },
    { key: 'timezone', value: settings.timezone || DEFAULT_TIMEZONE },
  ];
}
