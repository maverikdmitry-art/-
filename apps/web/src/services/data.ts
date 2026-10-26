import type {
  Account,
  AppSettings,
  AppStore,
  Category,
  CategoryGroup,
  Goal,
  GoalContribution,
  RecurringPayment,
  Transaction,
  Transfer,
} from '@oover/shared';
import {
  mapAccount,
  mapCategory,
  mapCategoryGroup,
  mapGoal,
  mapGoalContribution,
  mapRecurringPayment,
  mapSettings,
  mapTransaction,
  mapTransfer,
  mapUser,
  settingsToRows,
} from '@oover/shared';
import { getSupabase } from './supabaseClient';

/**
 * Слой данных дашборда: единственный источник правды — Supabase.
 *
 * Раньше здесь был localStorage с демо-сидом (из-за него «тестовые данные»
 * появлялись после чистилки/инкогнито). Теперь читаем и пишем прямо в таблицы
 * Supabase, используя общие мапперы @oover/shared (numeric → number).
 *
 * Views работают с готовым объектом `AppStore`; мутации — асинхронные,
 * после каждой App перечитывает store через `loadStore()`.
 */

type Row = Record<string, unknown>;

/** Загружает все таблицы и собирает `AppStore` для UI. */
export async function loadStore(): Promise<AppStore> {
  const supabase = getSupabase();

  const [users, accounts, groups, categories, transactions, transfers, goals, contributions, recurring, settings] =
    await Promise.all([
      supabase.from('users').select('*').order('id'),
      supabase.from('accounts').select('*').order('sort_order', { ascending: true }),
      supabase.from('category_groups').select('*').order('sort_order', { ascending: true }),
      supabase.from('categories').select('*').order('id'),
      supabase.from('transactions').select('*').order('occurred_at', { ascending: false }),
      supabase.from('transfers').select('*').order('occurred_at', { ascending: false }),
      supabase.from('goals').select('*').order('id'),
      supabase.from('goal_contributions').select('*').order('created_at', { ascending: false }),
      supabase.from('recurring_payments').select('*').order('id'),
      supabase.from('settings').select('key, value'),
    ]);

  const results = [users, accounts, groups, categories, transactions, transfers, goals, contributions, recurring, settings];
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  return {
    users: (users.data ?? []).map((r) => mapUser(r as Row)),
    accounts: (accounts.data ?? []).map((r) => mapAccount(r as Row)),
    category_groups: (groups.data ?? []).map((r) => mapCategoryGroup(r as Row)),
    categories: (categories.data ?? []).map((r) => mapCategory(r as Row)),
    transactions: (transactions.data ?? []).map((r) => mapTransaction(r as Row)),
    transfers: (transfers.data ?? []).map((r) => mapTransfer(r as Row)),
    goals: (goals.data ?? []).map((r) => mapGoal(r as Row)),
    goal_contributions: (contributions.data ?? []).map((r) => mapGoalContribution(r as Row)),
    recurring_payments: (recurring.data ?? []).map((r) => mapRecurringPayment(r as Row)),
    settings: mapSettings((settings.data ?? []) as Array<{ key: string; value: string }>),
  };
}

/** Строка транзакции для вставки/обновления (без id и служебных дат). */
function transactionToRow(tx: Partial<Transaction>): Row {
  return {
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency,
    account_id: tx.account_id,
    category_id: tx.category_id ?? null,
    user_id: tx.user_id,
    description: tx.description ?? null,
    note: tx.note ?? null,
    occurred_at: tx.occurred_at,
    status: tx.status,
    source: tx.source ?? 'dashboard',
    raw_text: tx.raw_text ?? null,
    telegram_chat_id: tx.telegram_chat_id ?? null,
    telegram_message_id: tx.telegram_message_id ?? null,
  };
}

// --- Транзакции ---

export async function saveTransaction(tx: Partial<Transaction>): Promise<void> {
  const supabase = getSupabase();
  const row = transactionToRow(tx);
  if (tx.id) {
    const { error } = await supabase.from('transactions').update(row).eq('id', tx.id);
    if (error) {
      console.error('[data.saveTransaction] update failed:', error.message, error);
      throw new Error(error.message);
    }
  } else {
    const { data, error } = await supabase.from('transactions').insert(row).select('id');
    if (error) {
      console.error('[data.saveTransaction] insert failed:', error.message, error);
      throw new Error(error.message);
    }
    console.info('[data.saveTransaction] inserted:', data);
  }
}

export async function deleteTransaction(id: number): Promise<void> {
  const { error } = await getSupabase().from('transactions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function bulkDeleteTransactions(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await getSupabase().from('transactions').delete().in('id', ids);
  if (error) throw new Error(error.message);
}

export async function bulkMarkOk(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await getSupabase()
    .from('transactions')
    .update({ status: 'ok' })
    .in('id', ids);
  if (error) throw new Error(error.message);
}

// --- Переводы ---

export async function saveTransfer(data: Omit<Transfer, 'id'>): Promise<void> {
  const { error } = await getSupabase().from('transfers').insert({
    from_account_id: data.from_account_id,
    to_account_id: data.to_account_id,
    amount_from: data.amount_from,
    amount_to: data.amount_to,
    user_id: data.user_id,
    note: data.note ?? null,
    occurred_at: data.occurred_at,
  });
  if (error) throw new Error(error.message);
}

export async function deleteTransfer(id: number): Promise<void> {
  const { error } = await getSupabase().from('transfers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// --- Цели накопления ---

export async function saveGoal(data: Partial<Goal>): Promise<void> {
  const supabase = getSupabase();
  if (data.id) {
    const { error } = await supabase
      .from('goals')
      .update({
        name: data.name,
        target_amount: data.target_amount,
        currency: data.currency,
        is_active: data.is_active,
      })
      .eq('id', data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('goals').insert({
      name: data.name ?? 'Новая цель',
      target_amount: data.target_amount ?? 10000,
      currency: data.currency ?? 'UAH',
      is_active: data.is_active ?? true,
    });
    if (error) throw new Error(error.message);
  }
}

/** Удаление цели каскадом уберёт её взносы (FK on delete cascade). */
export async function deleteGoal(id: number): Promise<void> {
  const { error } = await getSupabase().from('goals').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function saveContribution(
  data: Omit<GoalContribution, 'id' | 'created_at'>
): Promise<void> {
  const { error } = await getSupabase().from('goal_contributions').insert({
    goal_id: data.goal_id,
    amount: data.amount,
    user_id: data.user_id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteContribution(id: number): Promise<void> {
  const { error } = await getSupabase().from('goal_contributions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// --- Регулярные платежи ---

export async function saveRecurring(data: Partial<RecurringPayment>): Promise<void> {
  const supabase = getSupabase();
  if (data.id) {
    const { error } = await supabase
      .from('recurring_payments')
      .update({
        name: data.name,
        amount: data.amount,
        currency: data.currency,
        account_id: data.account_id ?? null,
        category_id: data.category_id ?? null,
        day_of_month: data.day_of_month,
        auto_confirm: data.auto_confirm,
        next_due: data.next_due,
        is_active: data.is_active,
        type: data.type,
      })
      .eq('id', data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('recurring_payments').insert({
      name: data.name ?? 'Платёж',
      amount: data.amount ?? 0,
      currency: data.currency ?? 'UAH',
      account_id: data.account_id ?? null,
      category_id: data.category_id ?? null,
      day_of_month: data.day_of_month ?? 1,
      auto_confirm: data.auto_confirm ?? false,
      next_due: data.next_due ?? new Date().toISOString().slice(0, 10),
      is_active: data.is_active ?? true,
      type: data.type ?? 'expense',
    });
    if (error) throw new Error(error.message);
  }
}

export async function deleteRecurring(id: number): Promise<void> {
  const { error } = await getSupabase().from('recurring_payments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// --- Счета ---

export async function saveAccount(data: Partial<Account>): Promise<void> {
  const supabase = getSupabase();
  if (data.id) {
    const { error } = await supabase
      .from('accounts')
      .update({
        name: data.name,
        kind: data.kind,
        currency: data.currency,
        initial_balance: data.initial_balance,
        is_active: data.is_active,
        sort_order: data.sort_order,
      })
      .eq('id', data.id);
    if (error) throw new Error(error.message);
  } else {
    const maxOrder = await getMaxSortOrder('accounts');
    const { error } = await supabase.from('accounts').insert({
      name: data.name ?? 'Новый счёт',
      kind: data.kind ?? 'card',
      currency: data.currency ?? 'UAH',
      initial_balance: data.initial_balance ?? 0,
      is_active: data.is_active ?? true,
      sort_order: maxOrder + 1,
    });
    if (error) throw new Error(error.message);
  }
}

export async function deleteAccount(id: number): Promise<void> {
  const { error } = await getSupabase().from('accounts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// --- Категории ---

export async function saveCategory(data: Partial<Category>): Promise<void> {
  const supabase = getSupabase();
  if (data.id) {
    const { error } = await supabase
      .from('categories')
      .update({
        name: data.name,
        group_id: data.group_id ?? null,
        type: data.type,
        is_active: data.is_active,
      })
      .eq('id', data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('categories').insert({
      name: data.name ?? 'Категория',
      group_id: data.group_id ?? null,
      type: data.type ?? 'expense',
      is_active: data.is_active ?? true,
    });
    if (error) throw new Error(error.message);
  }
}

export async function deleteCategory(id: number): Promise<void> {
  const { error } = await getSupabase().from('categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// --- Группы категорий ---

export async function saveGroup(data: Partial<CategoryGroup>): Promise<void> {
  const supabase = getSupabase();
  if (data.id) {
    const { error } = await supabase
      .from('category_groups')
      .update({ name: data.name, sort_order: data.sort_order })
      .eq('id', data.id);
    if (error) throw new Error(error.message);
  } else {
    const maxOrder = await getMaxSortOrder('category_groups');
    const { error } = await supabase.from('category_groups').insert({
      name: data.name ?? 'Группа',
      sort_order: maxOrder + 1,
    });
    if (error) throw new Error(error.message);
  }
}

// --- Настройки ---

/** Сохраняет настройки как пары key/value (upsert по key). */
export async function saveSettings(settings: AppSettings): Promise<void> {
  const rows = settingsToRows(settings);
  const { error } = await getSupabase().from('settings').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

/** Обновляет только дату следующего дохода, не затронув остальные настройки. */
export async function updateNextIncomeDate(nextIncomeDate: string): Promise<void> {
  const { error } = await getSupabase()
    .from('settings')
    .upsert([{ key: 'next_income_date', value: nextIncomeDate }], { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

// --- Очистка данных ---

/** Удаляет только транзакции, переводы и взносы (счета/категории/настройки не трогаем). */
export async function clearTestData(): Promise<void> {
  const supabase = getSupabase();
  const [tx, tr, gc] = await Promise.all([
    supabase.from('transactions').delete().neq('id', 0),
    supabase.from('transfers').delete().neq('id', 0),
    supabase.from('goal_contributions').delete().neq('id', 0),
  ]);
  const failed = [tx, tr, gc].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

/** Сброс: удаляем операции и возвращаем настройки к значениям по умолчанию. */
export async function resetToDefaults(): Promise<void> {
  await clearTestData();
  await saveSettings({
    usd_rate: 41.5,
    confirm_enabled: true,
    next_income_date: '',
    overspend_alert_pct: 30,
    timezone: 'Europe/Kyiv',
  });
}

/**
 * Подтверждение регулярного платежа: создаёт транзакцию (доход/расход)
 * и сдвигает next_due на следующий месяц. Обе операции выполняются в БД.
 */
export async function confirmRecurringPayment(rec: RecurringPayment, userId: number): Promise<void> {
  const supabase = getSupabase();
  const isIncome = rec.type === 'income';

  const { error: txError } = await supabase.from('transactions').insert({
    type: isIncome ? 'income' : 'expense',
    amount: rec.amount,
    currency: rec.currency,
    account_id: rec.account_id,
    category_id: rec.category_id,
    user_id: userId,
    description: isIncome ? `Регулярный доход: ${rec.name}` : `Регулярный платёж: ${rec.name}`,
    note: isIncome ? `Поступление за ${rec.next_due}` : `Оплата за ${rec.next_due}`,
    occurred_at: new Date().toISOString(),
    status: 'ok',
    source: 'dashboard',
  });
  if (txError) throw new Error(txError.message);

  const curDue = new Date(rec.next_due);
  const nextDueDate = new Date(curDue.getFullYear(), curDue.getMonth() + 1, rec.day_of_month);
  const updatedNextDue = nextDueDate.toISOString().slice(0, 10);
  const { error } = await supabase
    .from('recurring_payments')
    .update({ next_due: updatedNextDue })
    .eq('id', rec.id);
  if (error) throw new Error(error.message);
}

/**
 * Восстановление из бэкапа: перезаписывает содержимое таблиц данными из JSON.
 * Сначала чистим операции, затем upsert по всем сущностям (id сохраняем).
 */
export async function importStore(backup: AppStore): Promise<void> {
  const supabase = getSupabase();

  await supabase.from('transactions').delete().neq('id', 0);
  await supabase.from('transfers').delete().neq('id', 0);
  await supabase.from('goal_contributions').delete().neq('id', 0);

  if (backup.users?.length) {
    const { error } = await supabase.from('users').upsert(backup.users, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
  if (backup.category_groups?.length) {
    const { error } = await supabase.from('category_groups').upsert(backup.category_groups, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
  if (backup.categories?.length) {
    const { error } = await supabase.from('categories').upsert(backup.categories, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
  if (backup.accounts?.length) {
    const { error } = await supabase.from('accounts').upsert(backup.accounts, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
  if (backup.goals?.length) {
    const { error } = await supabase.from('goals').upsert(backup.goals, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
  if (backup.recurring_payments?.length) {
    const { error } = await supabase.from('recurring_payments').upsert(backup.recurring_payments, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
  if (backup.transactions?.length) {
    const { error } = await supabase.from('transactions').upsert(backup.transactions, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
  if (backup.transfers?.length) {
    const { error } = await supabase.from('transfers').upsert(backup.transfers, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
  if (backup.goal_contributions?.length) {
    const { error } = await supabase.from('goal_contributions').upsert(backup.goal_contributions, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
  if (backup.settings) {
    await saveSettings(backup.settings);
  }
}

// --- Внутренние помощники ---

async function getMaxSortOrder(table: 'accounts' | 'category_groups'): Promise<number> {
  const { data, error } = await getSupabase()
    .from(table)
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? Number((data[0] as Row).sort_order ?? 0) : 0;
}
