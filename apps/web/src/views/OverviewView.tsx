import React from 'react';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowRight,
  Target,
  Sparkles,
  Bot,
  Plus,
  ArrowLeftRight,
  Scale,
  CheckCircle2,
} from 'lucide-react';
import { Account, AppSettings, AppStore, Goal, RecurringPayment, Transaction } from '../types';
import {
  calculateAccountBalance,
  calculateMonthComparison,
  calculateNetWorth,
  calculateSafeToSpend,
  formatMoney,
} from '../services/calculations';

interface OverviewViewProps {
  store: AppStore;
  selectedUserId: number | 'all';
  onNavigateTab: (tab: string) => void;
  onOpenQuickAdd: () => void;
  onOpenQuickBot: () => void;
  onOpenTransfer: () => void;
  onOpenRevision: (account: Account) => void;
  onOpenGoalDeposit: (goal: Goal) => void;
  onConfirmRecurring: (rec: RecurringPayment) => void;
  onEditTransaction: (tx: Transaction) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  store,
  selectedUserId,
  onNavigateTab,
  onOpenQuickAdd,
  onOpenQuickBot,
  onOpenTransfer,
  onOpenRevision,
  onOpenGoalDeposit,
  onConfirmRecurring,
  onEditTransaction,
}) => {
  // Calculations
  const netWorth = calculateNetWorth(
    store.accounts,
    store.transactions,
    store.transfers,
    store.settings.usd_rate
  );

  const safeToSpend = calculateSafeToSpend(
    store.accounts,
    store.transactions,
    store.transfers,
    store.goal_contributions,
    store.recurring_payments,
    store.settings
  );

  const monthStats = calculateMonthComparison(
    store.transactions,
    store.settings.usd_rate,
    new Date()
  );

  // Filter transactions for preview based on selected user if applicable
  const displayTransactions = store.transactions
    .filter((tx) => (selectedUserId === 'all' ? true : tx.user_id === selectedUserId))
    .slice(0, 6);

  // Category map
  const catMap = new Map(store.categories.map((c) => [c.id, c.name]));
  const accMap = new Map(store.accounts.map((a) => [a.id, a.name]));
  const userMap = new Map(store.users.map((u) => [u.id, u.name]));

  // Upcoming recurring payments (next 7 days or overdue)
  const upcomingRecurring = store.recurring_payments
    .filter((r) => r.is_active)
    .sort((a, b) => a.next_due.localeCompare(b.next_due))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Safe-to-Spend Alert Banner (if <= 30% limit remaining or overspent) */}
      {safeToSpend.isAlert && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
          safeToSpend.isOverLimit
            ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 shrink-0 ${safeToSpend.isOverLimit ? 'text-rose-400' : 'text-amber-400'}`} />
            <div className="text-sm">
              <span className="font-semibold">
                {safeToSpend.isOverLimit ? 'Внимание: Дневной лимит превышен!' : 'Внимание: Остаток лимита на день ≤ 30%!'}
              </span>{' '}
              <span className="opacity-90">
                Сегодня израсходовано {formatMoney(safeToSpend.spentToday)} из безопасных {formatMoney(safeToSpend.safePerDay)}.
                Остаток: {formatMoney(safeToSpend.remainingLimit)}.
              </span>
            </div>
          </div>
          <button
            onClick={onOpenQuickBot}
            className="hidden sm:inline-flex px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-white whitespace-nowrap transition-colors"
          >
            Проверить траты
          </button>
        </div>
      )}

      {/* Main KPI Quad Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Net Worth */}
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Капитал</span>
              <span className="font-mono text-[11px] text-slate-500">1$ = {store.settings.usd_rate} ₴</span>
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
              {formatMoney(netWorth.netWorthUah, 'UAH')}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>В гривне: <strong className="text-slate-200 font-mono">{formatMoney(netWorth.totalUahAccounts, 'UAH')}</strong></span>
            <span>В валюте: <strong className="text-slate-200 font-mono">{formatMoney(netWorth.totalUsdAccounts, 'USD')}</strong></span>
          </div>
        </div>

        {/* Card 2: Safe-to-Spend (Key Formula) */}
        <div className={`p-5 rounded-xl border relative flex flex-col justify-between ${
          safeToSpend.isOverLimit
            ? 'bg-rose-950/20 border-rose-500/30'
            : safeToSpend.isAlert
            ? 'bg-amber-950/20 border-amber-500/30'
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Свободно на день</span>
              <span className="font-mono text-[11px] text-slate-400">
                {safeToSpend.daysLeft} дн. до дохода ({store.settings.next_income_date || '—'})
              </span>
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
              {formatMoney(safeToSpend.safePerDay, 'UAH')}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400">Потрачено сегодня:</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {formatMoney(safeToSpend.spentToday, 'UAH')}
              </span>
            </div>
            {/* Limit Progress Gauge */}
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  safeToSpend.isOverLimit
                    ? 'bg-rose-500'
                    : safeToSpend.isAlert
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, safeToSpend.pctSpentToday)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
              <span>Остаток лимита:</span>
              <span className={`font-mono font-medium ${safeToSpend.isOverLimit ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatMoney(safeToSpend.remainingLimit, 'UAH')}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Monthly Expenses with Delta */}
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Расходы за этот месяц</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
              {formatMoney(monthStats.curExpense, 'UAH')}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Прошлый месяц:</span>
            <span className="font-mono text-slate-400 tabular-nums">
              {formatMoney(monthStats.prevExpense, 'UAH')}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Сравнение (Δ):</span>
            <span className={`font-mono font-medium ${monthStats.expenseDelta > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {monthStats.expenseDelta > 0 ? `+${formatMoney(monthStats.expenseDelta)}` : formatMoney(monthStats.expenseDelta)}
            </span>
          </div>
        </div>

        {/* Card 4: Monthly Income with Delta */}
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Доходы за этот месяц</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
              {formatMoney(monthStats.curIncome, 'UAH')}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Прошлый месяц:</span>
            <span className="font-mono text-slate-400 tabular-nums">
              {formatMoney(monthStats.prevIncome, 'UAH')}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Сравнение (Δ):</span>
            <span className={`font-mono font-medium ${monthStats.incomeDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {monthStats.incomeDelta >= 0 ? `+${formatMoney(monthStats.incomeDelta)}` : formatMoney(monthStats.incomeDelta)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Action Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Быстрые действия</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={onOpenQuickBot}
            className="p-3.5 bg-slate-950 hover:bg-slate-850 border border-slate-800/80 hover:border-slate-700 rounded-xl flex items-center gap-3 transition-colors text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Быстрая операция</div>
              <div className="text-[11px] text-slate-400">Текст или голос</div>
            </div>
          </button>

          <button
            onClick={onOpenQuickAdd}
            className="p-3.5 bg-slate-950 hover:bg-slate-850 border border-slate-800/80 hover:border-slate-700 rounded-xl flex items-center gap-3 transition-colors text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Новая операция</div>
              <div className="text-[11px] text-slate-400">Форма с деталями</div>
            </div>
          </button>

          <button
            onClick={onOpenTransfer}
            className="p-3.5 bg-slate-950 hover:bg-slate-850 border border-slate-800/80 hover:border-slate-700 rounded-xl flex items-center gap-3 transition-colors text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Перевод со счёта</div>
              <div className="text-[11px] text-slate-400">Между картами и налом</div>
            </div>
          </button>

          <button
            onClick={() => {
              const firstAcc = store.accounts.find((a) => a.is_active);
              if (firstAcc) onOpenRevision(firstAcc);
            }}
            className="p-3.5 bg-slate-950 hover:bg-slate-850 border border-slate-800/80 hover:border-slate-700 rounded-xl flex items-center gap-3 transition-colors text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Сверить баланс</div>
              <div className="text-[11px] text-slate-400">Ревизия остатка</div>
            </div>
          </button>
        </div>
      </div>

      {/* Middle Two-Column Section: Accounts & Recurring Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Accounts Summary */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Счета и актуальные остатки</h3>
            </div>
            <button
              onClick={() => onNavigateTab('accounts')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>Все счета</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {store.accounts.filter((a) => a.is_active).map((acc) => {
              const bal = calculateAccountBalance(acc, store.transactions, store.transfers);
              return (
                <div
                  key={acc.id}
                  className="p-3.5 bg-slate-950 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-medium text-slate-200">{acc.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {acc.kind === 'card' ? 'Банковская карта' : 'Наличные средства'} · {acc.currency}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-white tabular-nums">
                      {formatMoney(bal, acc.currency)}
                    </div>
                    <button
                      onClick={() => onOpenRevision(acc)}
                      className="text-[10px] text-slate-400 hover:text-emerald-300 transition-colors underline cursor-pointer"
                    >
                      Сверить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Recurring Reminders (Section 4.4 ARCHITECTURE.md) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Регулярные платежи</h3>
            </div>
            <button
              onClick={() => onNavigateTab('recurring')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>Все</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {upcomingRecurring.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-medium text-slate-200">{item.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Срок: {item.next_due}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-white">
                    {formatMoney(item.amount, item.currency)}
                  </div>
                  <button
                    onClick={() => onConfirmRecurring(item)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                  >
                    Подтвердить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Savings Goals Widget */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Цели накопления</h3>
          </div>
          <button
            onClick={() => onNavigateTab('goals')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>Управление целями</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {store.goals.filter((g) => g.is_active).map((goal) => {
            const saved = store.goal_contributions
              .filter((c) => c.goal_id === goal.id)
              .reduce((sum, c) => sum + (c.amount || 0), 0);
            const pct = Math.min(100, Math.round((saved / goal.target_amount) * 100));

            return (
              <div key={goal.id} className="p-4 bg-slate-950 rounded-lg border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{goal.name}</span>
                  <button
                    onClick={() => onOpenGoalDeposit(goal)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                  >
                    + Взнос / Снятие
                  </button>
                </div>

                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Накоплено: <strong className="text-white">{formatMoney(saved, goal.currency)}</strong></span>
                  <span>Цель: {formatMoney(goal.target_amount, goal.currency)} ({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Недавние финансовые операции</h3>
          <button
            onClick={() => onNavigateTab('transactions')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>Вся история</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="pb-3 pl-2">Дата</th>
                <th className="pb-3">Описание</th>
                <th className="pb-3">Категория</th>
                <th className="pb-3">Счёт</th>
                <th className="pb-3">Автор</th>
                <th className="pb-3">Статус</th>
                <th className="pb-3 pr-2 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {displayTransactions.map((tx) => {
                const author = userMap.get(tx.user_id) || '—';
                const catName = catMap.get(tx.category_id || 0) || 'Без категории';
                const accName = accMap.get(tx.account_id) || '—';
                const dateStr = new Date(tx.occurred_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr
                    key={tx.id}
                    onClick={() => onEditTransaction(tx)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 pl-2 font-mono text-slate-400 whitespace-nowrap">{dateStr}</td>
                    <td className="py-3 font-medium text-white max-w-[200px] truncate">{tx.description}</td>
                    <td className="py-3 text-slate-300 whitespace-nowrap">{catName}</td>
                    <td className="py-3 text-slate-400 whitespace-nowrap">{accName}</td>
                    <td className="py-3 text-slate-400 whitespace-nowrap">{author}</td>
                    <td className="py-3 whitespace-nowrap">
                      {tx.status === 'needs_review' ? (
                        <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          на проверке
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400">ok</span>
                      )}
                    </td>
                    <td className="py-3 pr-2 text-right font-mono font-semibold whitespace-nowrap">
                      <span
                        className={
                          tx.type === 'income'
                            ? 'text-emerald-400'
                            : tx.type === 'adjustment'
                            ? tx.amount >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                            : 'text-rose-400'
                        }
                      >
                        {tx.type === 'income'
                          ? `+${formatMoney(tx.amount, tx.currency)}`
                          : tx.type === 'adjustment'
                          ? `${tx.amount >= 0 ? '+' : ''}${formatMoney(tx.amount, tx.currency)}`
                          : `-${formatMoney(tx.amount, tx.currency)}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
