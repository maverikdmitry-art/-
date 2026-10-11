import { AppStore } from '../types';

const STORAGE_KEY = 'ooverfinancee_store_v1';

export function getInitialSeedData(): AppStore {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  
  // Next income in 14 days
  const nextInc = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
  const nextIncomeStr = nextInc.toISOString().slice(0, 10);

  // Helper for generating dates relative to today
  const relativeIso = (daysAgo: number, hours: number = 14, minutes: number = 30) => {
    const d = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  return {
    users: [
      { id: 1, name: 'Дмитро', telegram_id: 100123456, notify_partner: true },
      { id: 2, name: 'Даша', telegram_id: 200654321, notify_partner: true },
    ],
    accounts: [
      { id: 1, name: 'Монобанк', kind: 'card', currency: 'UAH', initial_balance: 14500, is_active: true, sort_order: 1 },
      { id: 2, name: 'Райффайзен', kind: 'card', currency: 'UAH', initial_balance: 8200, is_active: true, sort_order: 2 },
      { id: 3, name: 'Наличка', kind: 'cash', currency: 'UAH', initial_balance: 3500, is_active: true, sort_order: 3 },
      { id: 4, name: 'USD Сейф', kind: 'cash', currency: 'USD', initial_balance: 1200, is_active: true, sort_order: 4 },
    ],
    category_groups: [
      { id: 1, name: 'Обязательные', sort_order: 1 },
      { id: 2, name: 'Необязательные', sort_order: 2 },
      { id: 3, name: 'Доходы', sort_order: 3 },
    ],
    categories: [
      // Обязательные (Group 1)
      { id: 1, name: 'Жильё', group_id: 1, type: 'expense', is_active: true },
      { id: 2, name: 'Коммуналка', group_id: 1, type: 'expense', is_active: true },
      { id: 3, name: 'Связь', group_id: 1, type: 'expense', is_active: true },
      { id: 4, name: 'Транспорт', group_id: 1, type: 'expense', is_active: true },
      { id: 5, name: 'Продукты', group_id: 1, type: 'expense', is_active: true },
      // Необязательные (Group 2)
      { id: 6, name: 'Кафе', group_id: 2, type: 'expense', is_active: true },
      { id: 7, name: 'Развлечения', group_id: 2, type: 'expense', is_active: true },
      { id: 8, name: 'Покупки', group_id: 2, type: 'expense', is_active: true },
      { id: 9, name: 'Подписки', group_id: 2, type: 'expense', is_active: true },
      { id: 10, name: 'Прочее', group_id: 2, type: 'expense', is_active: true },
      // Доходы (Group 3)
      { id: 11, name: 'Зарплата', group_id: 3, type: 'income', is_active: true },
      { id: 12, name: 'Прочий доход', group_id: 3, type: 'income', is_active: true },
    ],
    transactions: [
      {
        id: 1,
        type: 'income',
        amount: 42000,
        currency: 'UAH',
        account_id: 1,
        category_id: 11,
        user_id: 1,
        description: 'Аванс за проект',
        note: 'Зарплата Дмитро',
        occurred_at: relativeIso(8, 11, 0),
        status: 'ok',
        source: 'dashboard',
        raw_text: null,
        telegram_chat_id: null,
        telegram_message_id: null,
        created_at: relativeIso(8, 11, 0),
        updated_at: relativeIso(8, 11, 0),
      },
      {
        id: 2,
        type: 'income',
        amount: 28000,
        currency: 'UAH',
        account_id: 2,
        category_id: 11,
        user_id: 2,
        description: 'Зарплата за дизайн',
        note: 'Зарплата Даша',
        occurred_at: relativeIso(7, 10, 30),
        status: 'ok',
        source: 'dashboard',
        raw_text: null,
        telegram_chat_id: null,
        telegram_message_id: null,
        created_at: relativeIso(7, 10, 30),
        updated_at: relativeIso(7, 10, 30),
      },
      {
        id: 3,
        type: 'expense',
        amount: 1450,
        currency: 'UAH',
        account_id: 1,
        category_id: 5,
        user_id: 2,
        description: 'Супермаркет Сильпо',
        note: 'Сыр, овощи, бакалея на неделю',
        occurred_at: relativeIso(3, 19, 15),
        status: 'ok',
        source: 'bot',
        raw_text: 'продукты 1450 сильпо',
        telegram_chat_id: null,
        telegram_message_id: null,
        created_at: relativeIso(3, 19, 15),
        updated_at: relativeIso(3, 19, 15),
      },
      {
        id: 4,
        type: 'expense',
        amount: 220,
        currency: 'UAH',
        account_id: 1,
        category_id: 6,
        user_id: 1,
        description: 'Кофе и десерт',
        note: 'One Love Coffee',
        occurred_at: relativeIso(2, 9, 45),
        status: 'ok',
        source: 'bot',
        raw_text: 'кофе 220 one love',
        telegram_chat_id: null,
        telegram_message_id: null,
        created_at: relativeIso(2, 9, 45),
        updated_at: relativeIso(2, 9, 45),
      },
      {
        id: 5,
        type: 'expense',
        amount: 340,
        currency: 'UAH',
        account_id: 1,
        category_id: 4,
        user_id: 1,
        description: 'Bolt такси в центр',
        note: 'Поездка на встречу',
        occurred_at: relativeIso(1, 15, 20),
        status: 'ok',
        source: 'voice',
        raw_text: 'такси 340 болт на встречу',
        telegram_chat_id: null,
        telegram_message_id: null,
        created_at: relativeIso(1, 15, 20),
        updated_at: relativeIso(1, 15, 20),
      },
      {
        id: 6,
        type: 'expense',
        amount: 450,
        currency: 'UAH',
        account_id: 3,
        category_id: 5,
        user_id: 2,
        description: 'Рынок фермерский',
        note: 'Фрукты и зелень',
        occurred_at: relativeIso(1, 12, 10),
        status: 'ok',
        source: 'dashboard',
        raw_text: null,
        telegram_chat_id: null,
        telegram_message_id: null,
        created_at: relativeIso(1, 12, 10),
        updated_at: relativeIso(1, 12, 10),
      },
      {
        id: 7,
        type: 'expense',
        amount: 380,
        currency: 'UAH',
        account_id: 1,
        category_id: 6,
        user_id: 1,
        description: 'Обед в кафе',
        note: 'Бизнес ланч',
        occurred_at: relativeIso(0, 13, 10),
        status: 'ok',
        source: 'bot',
        raw_text: 'обед 380 кафе',
        telegram_chat_id: null,
        telegram_message_id: null,
        created_at: relativeIso(0, 13, 10),
        updated_at: relativeIso(0, 13, 10),
      },
      {
        id: 8,
        type: 'expense',
        amount: 190,
        currency: 'UAH',
        account_id: 2,
        category_id: 8,
        user_id: 2,
        description: 'Канцелярия и мелочи',
        note: 'Блокнот для эскизов',
        occurred_at: relativeIso(0, 16, 40),
        status: 'ok',
        source: 'bot',
        raw_text: 'блокнот 190',
        telegram_chat_id: null,
        telegram_message_id: null,
        created_at: relativeIso(0, 16, 40),
        updated_at: relativeIso(0, 16, 40),
      },
      {
        id: 9,
        type: 'expense',
        amount: 600,
        currency: 'UAH',
        account_id: 1,
        category_id: 10,
        user_id: 1,
        description: 'Неопределенная трата у дома',
        note: 'Требует уточнения категории',
        occurred_at: relativeIso(0, 10, 0),
        status: 'needs_review',
        source: 'voice',
        raw_text: 'какой-то платеж 600 возле терминала',
        telegram_chat_id: null,
        telegram_message_id: null,
        created_at: relativeIso(0, 10, 0),
        updated_at: relativeIso(0, 10, 0),
      },
    ],
    transfers: [
      {
        id: 1,
        from_account_id: 1,
        to_account_id: 3,
        amount_from: 3000,
        amount_to: 3000,
        user_id: 1,
        note: 'Снятие наличных в банкомате',
        occurred_at: relativeIso(5, 14, 0),
      },
    ],
    goals: [
      {
        id: 1,
        name: 'Подушка безопасности',
        target_amount: 60000,
        currency: 'UAH',
        is_active: true,
        created_at: relativeIso(30),
      },
      {
        id: 2,
        name: 'Отпуск в Карпатах',
        target_amount: 30000,
        currency: 'UAH',
        is_active: true,
        created_at: relativeIso(20),
      },
    ],
    goal_contributions: [
      { id: 1, goal_id: 1, amount: 20000, user_id: 1, created_at: relativeIso(15) },
      { id: 2, goal_id: 2, amount: 8500, user_id: 2, created_at: relativeIso(5) },
    ],
    recurring_payments: [
      {
        id: 1,
        name: 'Аренда квартиры',
        amount: 14000,
        currency: 'UAH',
        account_id: 1,
        category_id: 1,
        day_of_month: 25,
        auto_confirm: false,
        next_due: nextIncomeStr,
        is_active: true,
        type: 'expense',
      },
      {
        id: 2,
        name: 'Интернет и связь',
        amount: 450,
        currency: 'UAH',
        account_id: 1,
        category_id: 3,
        day_of_month: 15,
        auto_confirm: true,
        next_due: todayStr,
        is_active: true,
        type: 'expense',
      },
      {
        id: 3,
        name: 'Подписка Spotify & YouTube',
        amount: 289,
        currency: 'UAH',
        account_id: 2,
        category_id: 9,
        day_of_month: 20,
        auto_confirm: true,
        next_due: nextIncomeStr,
        is_active: true,
        type: 'expense',
      },
      {
        id: 4,
        name: 'Основная зарплата',
        amount: 42000,
        currency: 'UAH',
        account_id: 1,
        category_id: 11,
        day_of_month: 10,
        auto_confirm: false,
        next_due: nextIncomeStr,
        is_active: true,
        type: 'income',
      },
    ],
    settings: {
      usd_rate: 41.5,
      confirm_enabled: true,
      next_income_date: nextIncomeStr,
      overspend_alert_pct: 30,
      timezone: 'Europe/Kyiv',
    },
  };
}

export function loadStore(): AppStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialSeedData();
      saveStore(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    // Basic schema check
    if (!parsed.accounts || !parsed.transactions || !parsed.settings) {
      const initial = getInitialSeedData();
      saveStore(initial);
      return initial;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load store from localStorage:', err);
    return getInitialSeedData();
  }
}

export function saveStore(store: AppStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.error('Failed to save store to localStorage:', err);
  }
}

/**
 * Resets strictly test operations (transactions, transfers, goal contributions)
 * Preserves accounts, category structure, and custom settings as per DATABASE.md Section 9!
 */
export function clearTestDataOnly(store: AppStore): AppStore {
  const updated: AppStore = {
    ...store,
    transactions: [],
    transfers: [],
    goal_contributions: [],
  };
  saveStore(updated);
  return updated;
}

export function resetToDefaults(): AppStore {
  const fresh = getInitialSeedData();
  saveStore(fresh);
  return fresh;
}

export function exportBackupJson(store: AppStore): string {
  return JSON.stringify(store, null, 2);
}

export function exportTransactionsCsv(store: AppStore): string {
  const headers = [
    'ID',
    'Дата',
    'Тип',
    'Сумма',
    'Валюта',
    'Счёт',
    'Категория',
    'Автор',
    'Описание',
    'Комментарий',
    'Статус',
    'Источник',
  ];

  const userMap = new Map(store.users.map((u) => [u.id, u.name]));
  const accMap = new Map(store.accounts.map((a) => [a.id, a.name]));
  const catMap = new Map(store.categories.map((c) => [c.id, c.name]));

  const rows = store.transactions.map((tx) => [
    tx.id,
    tx.occurred_at,
    tx.type,
    tx.amount,
    tx.currency,
    `"${(accMap.get(tx.account_id) || '').replace(/"/g, '""')}"`,
    `"${(catMap.get(tx.category_id || 0) || '').replace(/"/g, '""')}"`,
    `"${(userMap.get(tx.user_id) || '').replace(/"/g, '""')}"`,
    `"${(tx.description || '').replace(/"/g, '""')}"`,
    `"${(tx.note || '').replace(/"/g, '""')}"`,
    tx.status,
    tx.source,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
