import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Plus } from 'lucide-react';
import { AppStore, Transaction } from '../types';
import { calculateSafeToSpend, formatMoney } from '../services/calculations';

interface CalendarViewProps {
  store: AppStore;
  selectedUserId: number | 'all';
  onEditTransaction: (tx: Transaction) => void;
  onAddTransaction: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  store,
  selectedUserId,
  onEditTransaction,
  onAddTransaction,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayTxs, setSelectedDayTxs] = useState<{ date: string; items: Transaction[] } | null>(null);

  const safeToSpend = useMemo(
    () =>
      calculateSafeToSpend(
        store.accounts,
        store.transactions,
        store.transfers,
        store.goal_contributions,
        store.recurring_payments,
        store.settings
      ),
    [store]
  );

  const dailyThreshold = safeToSpend.safePerDay;

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const todayMonth = () => {
    setCurrentDate(new Date());
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  // Filter transactions for calendar
  const filteredTxs = useMemo(() => {
    return store.transactions.filter((tx) =>
      selectedUserId === 'all' ? true : tx.user_id === selectedUserId
    );
  }, [store.transactions, selectedUserId]);

  // Aggregate by day string YYYY-MM-DD
  const dailyData = useMemo(() => {
    const map = new Map<string, { expense: number; income: number; items: Transaction[] }>();

    for (const tx of filteredTxs) {
      const dStr = tx.occurred_at.slice(0, 10);
      const existing = map.get(dStr) || { expense: 0, income: 0, items: [] };

      const amt = tx.currency === 'USD' ? tx.amount * store.settings.usd_rate : tx.amount;
      if (tx.type === 'expense') {
        existing.expense += amt;
      } else if (tx.type === 'income') {
        existing.income += amt;
      }
      existing.items.push(tx);
      map.set(dStr, existing);
    }

    return map;
  }, [filteredTxs, store.settings.usd_rate]);

  const monthNames = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ];

  const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const catMap = useMemo(() => new Map(store.categories.map((c) => [c.id, c.name])), [store.categories]);
  const userMap = useMemo(() => new Map(store.users.map((u) => [u.id, u.name])), [store.users]);

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">
            {monthNames[month]} {year}
          </h2>
          <span className="text-xs text-slate-400">
            (Дневной лимит: <strong className="text-emerald-400 font-mono">{formatMoney(dailyThreshold)}</strong>)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={todayMonth}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-950 border border-slate-800 rounded-lg transition-colors"
          >
            Текущий месяц
          </button>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={prevMonth}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden p-4">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {daysOfWeek.map((day, idx) => (
            <div
              key={day}
              className={`text-center text-xs font-semibold py-1.5 ${
                idx >= 5 ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Cells */}
        <div className="grid grid-cols-7 gap-2">
          {/* Empty offset days */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-24 sm:h-28 rounded-lg bg-slate-950/30 opacity-20" />
          ))}

          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const data = dailyData.get(dateStr);
            const isToday =
              new Date().toISOString().slice(0, 10) === dateStr;

            // DATABASE.md Section 7: "дни с превышением подсвечиваются мягким красным"
            const isOverspend = data && data.expense > dailyThreshold;

            return (
              <div
                key={dayNum}
                onClick={() => {
                  if (data && data.items.length > 0) {
                    setSelectedDayTxs({ date: dateStr, items: data.items });
                  }
                }}
                className={`h-24 sm:h-28 p-2 rounded-lg border transition-all flex flex-col justify-between cursor-pointer group ${
                  isOverspend
                    ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500'
                    : isToday
                    ? 'bg-slate-850 border-emerald-500/50 hover:border-emerald-400'
                    : data && data.items.length > 0
                    ? 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/60 border-slate-850 hover:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono font-medium ${
                      isToday
                        ? 'text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded'
                        : 'text-slate-400 group-hover:text-white'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {data && data.items.length > 0 && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {data.items.length} оп.
                    </span>
                  )}
                </div>

                {data && (
                  <div className="space-y-0.5 text-right font-mono text-[11px]">
                    {data.expense > 0 && (
                      <div className={isOverspend ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        -{formatMoney(data.expense)}
                      </div>
                    )}
                    {data.income > 0 && (
                      <div className="text-emerald-400 font-semibold">
                        +{formatMoney(data.income)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Details Modal / Drawer */}
      {selectedDayTxs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Операции за {new Date(selectedDayTxs.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>
                <span className="text-xs text-slate-400">
                  Всего записей: {selectedDayTxs.items.length}
                </span>
              </div>
              <button
                onClick={() => setSelectedDayTxs(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {selectedDayTxs.items.map((tx) => {
                const catName = catMap.get(tx.category_id || 0) || 'Без категории';
                const author = userMap.get(tx.user_id) || '—';
                const timeStr = new Date(tx.occurred_at).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={tx.id}
                    onClick={() => {
                      onEditTransaction(tx);
                      setSelectedDayTxs(null);
                    }}
                    className="p-3 bg-slate-950 hover:bg-slate-850 rounded-lg border border-slate-800 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">{tx.description}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{catName}</span>
                        <span>·</span>
                        <span>{author}</span>
                        <span>·</span>
                        <span className="font-mono text-slate-500">{timeStr}</span>
                      </div>
                    </div>
                    <div className="text-xs font-mono font-bold">
                      <span className={tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}>
                        {tx.type === 'income' ? `+${formatMoney(tx.amount, tx.currency)}` : `-${formatMoney(tx.amount, tx.currency)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
