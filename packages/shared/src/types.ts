/**
 * Канонические типы данных OoverrFinancee.
 * Совпадают 1-в-1 с таблицами PostgreSQL (см. supabase/schema.sql).
 * Используются и веб-дашбордом, и Telegram-ботом.
 */

export type Currency = 'UAH' | 'USD';

export type User = {
  id: number;
  name: string;
  telegram_id: number;
  notify_partner: boolean;
};

export type AccountKind = 'card' | 'cash';

export type Account = {
  id: number;
  name: string;
  kind: AccountKind;
  currency: Currency;
  initial_balance: number;
  is_active: boolean;
  sort_order: number;
};

export type CategoryGroup = {
  id: number;
  name: string;
  sort_order: number;
};

export type CategoryType = 'expense' | 'income';

export type Category = {
  id: number;
  name: string;
  group_id: number | null;
  type: CategoryType;
  is_active: boolean;
};

export type TransactionType = 'expense' | 'income' | 'adjustment';
export type TransactionStatus = 'ok' | 'needs_review';
export type TransactionSource = 'bot' | 'voice' | 'dashboard';

export type Transaction = {
  id: number;
  type: TransactionType;
  amount: number;
  currency: Currency;
  account_id: number;
  category_id: number | null;
  user_id: number;
  description: string | null;
  note: string | null;
  occurred_at: string;
  status: TransactionStatus;
  source: TransactionSource;
  raw_text: string | null;
  telegram_chat_id: number | null;
  telegram_message_id: number | null;
  created_at: string;
  updated_at: string;
};

/** Транзакция до вставки в БД (id и служебные даты проставит PostgreSQL). */
export type NewTransaction = Omit<
  Transaction,
  'id' | 'created_at' | 'updated_at' | 'telegram_chat_id' | 'telegram_message_id'
> & {
  telegram_chat_id?: number | null;
  telegram_message_id?: number | null;
};

export type Transfer = {
  id: number;
  from_account_id: number;
  to_account_id: number;
  amount_from: number;
  amount_to: number;
  user_id: number;
  note: string | null;
  occurred_at: string;
};

export type Goal = {
  id: number;
  name: string;
  target_amount: number;
  currency: Currency;
  is_active: boolean;
  created_at: string;
};

export type GoalContribution = {
  id: number;
  goal_id: number;
  amount: number;
  user_id: number | null;
  created_at: string;
};

export type RecurringType = 'expense' | 'income';

export type RecurringPayment = {
  id: number;
  name: string;
  amount: number;
  currency: Currency;
  account_id: number | null;
  category_id: number | null;
  day_of_month: number;
  auto_confirm: boolean;
  next_due: string;
  is_active: boolean;
  type: RecurringType;
};

export type AppSettings = {
  usd_rate: number;
  confirm_enabled: boolean;
  next_income_date: string;
  overspend_alert_pct: number;
  timezone: string;
};

/** Полный слепок данных приложения (используется дашбордом). */
export type AppStore = {
  users: User[];
  accounts: Account[];
  category_groups: CategoryGroup[];
  categories: Category[];
  transactions: Transaction[];
  transfers: Transfer[];
  goals: Goal[];
  goal_contributions: GoalContribution[];
  recurring_payments: RecurringPayment[];
  settings: AppSettings;
};
