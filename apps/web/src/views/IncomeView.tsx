import React, { useState } from 'react';
import { TrendingUp, Plus, Calendar, Edit2, Trash2, Check } from 'lucide-react';
import { AppStore, Transaction } from '../types';
import { formatMoney } from '../services/calculations';

interface IncomeViewProps {
  store: AppStore;
  onAddTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: number) => void;
  onUpdateNextIncomeDate: (newDate: string) => void;
}

export const IncomeView: React.FC<IncomeViewProps> = ({
  store,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onUpdateNextIncomeDate,
}) => {
  const [editingDate, setEditingDate] = useState(false);
  const [nextIncomeDateInput, setNextIncomeDateInput] = useState(store.settings.next_income_date);

  const incomeTransactions = store.transactions.filter((tx) => tx.type === 'income');
  const totalIncomeAllTime = incomeTransactions.reduce((sum, tx) => {
    const amt = tx.currency === 'USD' ? tx.amount * store.settings.usd_rate : tx.amount;
    return sum + amt;
  }, 0);

  // Current month income
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const currentMonthIncome = incomeTransactions
    .filter((tx) => {
      const d = new Date(tx.occurred_at);
      return d.getFullYear() === curYear && d.getMonth() === curMonth;
    })
    .reduce((sum, tx) => {
      const amt = tx.currency === 'USD' ? tx.amount * store.settings.usd_rate : tx.amount;
      return sum + amt;
    }, 0);

  const catMap = new Map(store.categories.map((c) => [c.id, c.name]));
  const accMap = new Map(store.accounts.map((a) => [a.id, a.name]));
  const userMap = new Map(store.users.map((u) => [u.id, u.name]));

  const handleSaveDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (nextIncomeDateInput) {
      onUpdateNextIncomeDate(nextIncomeDateInput);
      setEditingDate(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Next Income Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Доход за текущий месяц</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {formatMoney(currentMonthIncome, 'UAH')}
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            Всего поступлений: {incomeTransactions.length}
          </div>
        </div>

        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Общая сумма доходов (за всё время)</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {formatMoney(totalIncomeAllTime, 'UAH')}
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            Включает зарплаты и прочие поступления
          </div>
        </div>

        {/* Next Income Schedule Card */}
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Дата следующего регулярного дохода</span>
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          {!editingDate ? (
            <div className="flex items-center justify-between">
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {store.settings.next_income_date || 'Не задана'}
              </div>
              <button
                onClick={() => setEditingDate(true)}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Изменить дату дохода"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveDate} className="space-y-2 mt-1">
              <input
                type="date"
                value={nextIncomeDateInput}
                onChange={(e) => setNextIncomeDateInput(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-white text-xs font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDate(false)}
                  className="px-2 py-1 text-[11px] text-slate-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-[11px] font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded"
                >
                  Сохранить
                </button>
              </div>
            </form>
          )}
          <div className="mt-2 text-[11px] text-slate-500">
            Используется в расчёте шкалы Safe-to-spend.
          </div>
        </div>
      </div>

      {/* Income Transactions Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Список всех поступлений (доходов)</h3>
          <button
            onClick={onAddTransaction}
            className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Добавить доход</span>
          </button>
        </div>

        {incomeTransactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Поступлений доходов пока не зарегистрировано.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-3 pl-2">Дата</th>
                  <th className="py-3">Описание</th>
                  <th className="py-3">Категория</th>
                  <th className="py-3">Счёт зачисления</th>
                  <th className="py-3">Автор</th>
                  <th className="py-3 pr-2 text-right">Сумма</th>
                  <th className="py-3 pr-2 text-right w-16">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {incomeTransactions.map((tx) => {
                  const author = userMap.get(tx.user_id) || '—';
                  const catName = catMap.get(tx.category_id || 0) || 'Доход';
                  const accName = accMap.get(tx.account_id) || '—';
                  const dateStr = new Date(tx.occurred_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 pl-2 font-mono text-slate-400 whitespace-nowrap">{dateStr}</td>
                      <td className="py-3 font-medium text-white">{tx.description}</td>
                      <td className="py-3 text-slate-300">{catName}</td>
                      <td className="py-3 text-slate-400">{accName}</td>
                      <td className="py-3 text-slate-400">{author}</td>
                      <td className="py-3 pr-2 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        +{formatMoney(tx.amount, tx.currency)}
                      </td>
                      <td className="py-3 pr-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-1 rounded text-slate-400 hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Удалить доход «${tx.description}»?`)) {
                                onDeleteTransaction(tx.id);
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
