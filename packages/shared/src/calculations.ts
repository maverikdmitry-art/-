import type {
  Account,
  AppSettings,
  GoalContribution,
  RecurringPayment,
  Transaction,
  Transfer,
} from './types';
import { convertToUah, formatMoney, round2, sumMoney, toDecimal } from './money';
import { daysBetweenYmd, toYmd, todayYmd } from './time';

/**
 * Бизнес-формулы (по DATABASE.md, разделы 4, 5, 7).
 * Только здесь считаются балансы, Net Worth и Safe-to-spend.
 * UI никогда не считает деньги сам — он вызывает эти функции.
 */

export { formatMoney };

const FALLBACK_USD_RATE = 41.5;

/** Баланс счёта: стартовый остаток + доходы − расходы ± корректировки ± переводы. */
export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[],
  transfers: Transfer[]
): number {
  const accountTransactions = transactions.filter((tx) => tx.account_id === account.id);

  const income = sumMoney(
    accountTransactions.filter((tx) => tx.type === 'income').map((tx) => tx.amount)
  );
  const expense = sumMoney(
    accountTransactions.filter((tx) => tx.type === 'expense').map((tx) => tx.amount)
  );
  // adjustment: сумма со знаком (может быть отрицательной)
  const adjustments = sumMoney(
    accountTransactions.filter((tx) => tx.type === 'adjustment').map((tx) => tx.amount)
  );

  const incoming = sumMoney(
    transfers.filter((tr) => tr.to_account_id === account.id).map((tr) => tr.amount_to)
  );
  const outgoing = sumMoney(
    transfers.filter((tr) => tr.from_account_id === account.id).map((tr) => tr.amount_from)
  );

  const balance = toDecimal(account.initial_balance)
    .plus(income)
    .minus(expense)
    .plus(adjustments)
    .plus(incoming)
    .minus(outgoing);

  return round2(balance);
}

export type NetWorthResult = {
  netWorthUah: number;
  totalUahAccounts: number;
  totalUsdAccounts: number;
};

/** Net Worth = Σ балансов (UAH) + Σ балансов (USD) × курс. */
export function calculateNetWorth(
  accounts: Account[],
  transactions: Transaction[],
  transfers: Transfer[],
  usdRate: number
): NetWorthResult {
  let totalUahAccounts = 0;
  let totalUsdAccounts = 0;

  for (const account of accounts) {
    if (!account.is_active) continue;
    const balance = calculateAccountBalance(account, transactions, transfers);
    if (account.currency === 'USD') {
      totalUsdAccounts += balance;
    } else {
      totalUahAccounts += balance;
    }
  }

  return {
    netWorthUah: round2(toDecimal(totalUahAccounts).plus(toDecimal(totalUsdAccounts).times(usdRate))),
    totalUahAccounts: round2(totalUahAccounts),
    totalUsdAccounts: round2(totalUsdAccounts),
  };
}

export type SafeToSpendResult = {
  available: number;
  daysLeft: number;
  safePerDay: number;
  spentToday: number;
  remainingLimit: number;
  pctSpentToday: number;
  isAlert: boolean;
  isOverLimit: boolean;
  totalGoalsSaved: number;
  pendingRecurringSum: number;
  hasNextIncomeDate: boolean;
};

/**
 * Safe-to-spend (DATABASE.md, раздел 7).
 * available = Σ балансов (в UAH) − отложено в цели − предстоящие регулярные платежи
 * days_left = max(1, next_income_date − today)   (даты по Europe/Kyiv)
 * safe_per_day = available / days_left
 * remaining_limit = safe_per_day − потрачено сегодня
 */
export function calculateSafeToSpend(
  accounts: Account[],
  transactions: Transaction[],
  transfers: Transfer[],
  contributions: GoalContribution[],
  recurring: RecurringPayment[],
  settings: AppSettings
): SafeToSpendResult {
  const timezone = settings.timezone || 'Europe/Kyiv';
  const usdRate = settings.usd_rate > 0 ? settings.usd_rate : FALLBACK_USD_RATE;
  const hasNextIncomeDate = Boolean(settings.next_income_date);

  // 1. Ликвидный баланс, пересчитанный в UAH
  let totalBalanceUah = 0;
  for (const account of accounts) {
    if (!account.is_active) continue;
    const balance = calculateAccountBalance(account, transactions, transfers);
    totalBalanceUah += convertToUah(balance, account.currency, usdRate);
  }

  // 2. Отложено в цели
  const totalGoalsSaved = sumMoney(contributions.map((c) => c.amount));

  // 3. Предстоящие регулярные платежи (next_due ≤ next_income_date)
  const nextIncomeDate = settings.next_income_date || todayYmd(timezone);
  let pendingRecurringSum = 0;
  for (const item of recurring) {
    if (!item.is_active) continue;
    if (item.next_due <= nextIncomeDate) {
      pendingRecurringSum += convertToUah(item.amount, item.currency, usdRate);
    }
  }
  pendingRecurringSum = round2(pendingRecurringSum);

  const available = Math.max(0, round2(toDecimal(totalBalanceUah).minus(totalGoalsSaved).minus(pendingRecurringSum)));

  // 4. Дней до дохода (по киевским суткам)
  const todayStr = todayYmd(timezone);
  const daysLeft = hasNextIncomeDate ? Math.max(1, daysBetweenYmd(todayStr, nextIncomeDate)) : 1;
  const safePerDay = round2(toDecimal(available).dividedBy(daysLeft));

  // 5. Потрачено сегодня (расходы за текущие киевские сутки, в UAH)
  let spentToday = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (toYmd(tx.occurred_at, timezone) === todayStr) {
      spentToday += convertToUah(tx.amount, tx.currency, usdRate);
    }
  }
  spentToday = round2(spentToday);

  const remainingLimit = round2(toDecimal(safePerDay).minus(spentToday));
  const pctSpentToday = safePerDay > 0 ? round2(toDecimal(spentToday).dividedBy(safePerDay).times(100)) : 0;
  const isOverLimit = remainingLimit < 0;

  // Оповещение: остаток ≤ overspend_alert_pct% от дневного лимита
  const alertThreshold = round2(toDecimal(safePerDay).times(settings.overspend_alert_pct || 30).dividedBy(100));
  const isAlert = isOverLimit || remainingLimit <= alertThreshold;

  return {
    available,
    daysLeft,
    safePerDay,
    spentToday,
    remainingLimit,
    pctSpentToday: Math.min(100, pctSpentToday),
    isAlert,
    isOverLimit,
    totalGoalsSaved: round2(totalGoalsSaved),
    pendingRecurringSum,
    hasNextIncomeDate,
  };
}

export type MonthComparisonResult = {
  curExpense: number;
  curIncome: number;
  prevExpense: number;
  prevIncome: number;
  expenseDelta: number;
  incomeDelta: number;
};

/** Сравнение текущего месяца с прошлым (DATABASE.md, раздел 7). */
export function calculateMonthComparison(
  transactions: Transaction[],
  usdRate: number,
  baseDate: Date = new Date()
): MonthComparisonResult {
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth();
  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);

  let curExpense = 0;
  let curIncome = 0;
  let prevExpense = 0;
  let prevIncome = 0;

  for (const tx of transactions) {
    if (tx.type === 'adjustment') continue;
    const date = new Date(tx.occurred_at);
    const year = date.getFullYear();
    const month = date.getMonth();
    const amount = convertToUah(tx.amount, tx.currency, usdRate);

    if (year === currentYear && month === currentMonth) {
      if (tx.type === 'expense') curExpense += amount;
      if (tx.type === 'income') curIncome += amount;
    } else if (year === prevMonthDate.getFullYear() && month === prevMonthDate.getMonth()) {
      if (tx.type === 'expense') prevExpense += amount;
      if (tx.type === 'income') prevIncome += amount;
    }
  }

  return {
    curExpense: round2(curExpense),
    curIncome: round2(curIncome),
    prevExpense: round2(prevExpense),
    prevIncome: round2(prevIncome),
    expenseDelta: round2(toDecimal(curExpense).minus(prevExpense)),
    incomeDelta: round2(toDecimal(curIncome).minus(prevIncome)),
  };
}

/** Предстоящие платежи из списка (next_due ≤ заданной даты). */
export function pendingRecurring(
  recurring: RecurringPayment[],
  untilYmd: string
): RecurringPayment[] {
  return recurring.filter((item) => item.is_active && item.next_due <= untilYmd);
}
