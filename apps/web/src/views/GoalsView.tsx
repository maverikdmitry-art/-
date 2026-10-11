import React, { useState } from 'react';
import { Target, Plus, Edit2, Trash2, Check, X, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AppStore, Currency, Goal, GoalContribution } from '../types';
import { formatMoney } from '../services/calculations';

interface GoalsViewProps {
  store: AppStore;
  onOpenDeposit: (goal: Goal) => void;
  onSaveGoal: (goal: Partial<Goal>) => void;
  onDeleteGoal: (id: number) => void;
  onDeleteContribution: (id: number) => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  store,
  onOpenDeposit,
  onSaveGoal,
  onDeleteGoal,
  onDeleteContribution,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('UAH');

  const handleOpenAdd = () => {
    setName('');
    setTargetAmount('');
    setCurrency('UAH');
    setEditingGoal(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (goal: Goal) => {
    setName(goal.name);
    setTargetAmount(String(goal.target_amount));
    setCurrency(goal.currency);
    setEditingGoal(goal);
    setIsAddOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numTarget = parseFloat(targetAmount);
    if (!name.trim() || isNaN(numTarget) || numTarget <= 0) return;

    onSaveGoal({
      ...(editingGoal ? { id: editingGoal.id } : {}),
      name: name.trim(),
      target_amount: numTarget,
      currency,
      is_active: true,
      created_at: editingGoal?.created_at || new Date().toISOString(),
    });

    setIsAddOpen(false);
  };

  const userMap = new Map(store.users.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Цели накопления и копилки</h2>
          <p className="text-xs text-slate-400">
            Средства, отложенные в цели, исключаются из Safe-to-spend, но остаются частью общего Net Worth.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Новая цель</span>
        </button>
      </div>

      {/* Goals Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {store.goals.map((goal) => {
          const contributions = store.goal_contributions.filter((c) => c.goal_id === goal.id);
          const saved = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
          const pct = Math.min(100, Math.round((saved / goal.target_amount) * 100));
          const remaining = Math.max(0, goal.target_amount - saved);

          return (
            <div
              key={goal.id}
              className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{goal.name}</h3>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Цель: {formatMoney(goal.target_amount, goal.currency)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(goal)}
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">
                      Накоплено: <strong className="text-white font-bold">{formatMoney(saved, goal.currency)}</strong>
                    </span>
                    <span className="text-emerald-400 font-semibold">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono text-right">
                    Осталось собрать: {formatMoney(remaining, goal.currency)}
                  </div>
                </div>
              </div>

              {/* Actions & recent deposits */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => onOpenDeposit(goal)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Взнос / Снятие</span>
                </button>

                <span className="text-xs text-slate-500 font-mono">
                  {contributions.length} операций по цели
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Contributions History */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">История взносов и снятий с целей</h3>
        {store.goal_contributions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Взносов по целям ещё не совершалось.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="pb-2.5 pl-2">Дата</th>
                  <th className="pb-2.5">Цель</th>
                  <th className="pb-2.5">Автор</th>
                  <th className="pb-2.5 pr-2 text-right">Сумма</th>
                  <th className="pb-2.5 pr-2 text-right w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {store.goal_contributions.map((c) => {
                  const goal = store.goals.find((g) => g.id === c.goal_id);
                  const author = userMap.get(c.user_id || 0) || '—';
                  const dateStr = new Date(c.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 pl-2 font-mono text-slate-400 whitespace-nowrap">{dateStr}</td>
                      <td className="py-2.5 font-medium text-white">{goal?.name || 'Цель'}</td>
                      <td className="py-2.5 text-slate-400">{author}</td>
                      <td className="py-2.5 pr-2 text-right font-mono font-semibold whitespace-nowrap">
                        <span className={c.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {c.amount >= 0 ? `+${formatMoney(c.amount, goal?.currency)}` : formatMoney(c.amount, goal?.currency)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        <button
                          onClick={() => {
                            if (confirm('Удалить запись о взносе?')) {
                              onDeleteContribution(c.id);
                            }
                          }}
                          className="p-1 rounded text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Goal Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">
                {editingGoal ? 'Редактировать цель' : 'Создать новую цель'}
              </h2>
              <button onClick={() => setIsAddOpen(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Название цели</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Например: Подушка безопасности, Отпуск, Автомобиль..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Целевая сумма</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Валюта</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                  >
                    <option value="UAH">UAH (₴)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                {editingGoal && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Удалить цель «${editingGoal.name}»?`)) {
                        onDeleteGoal(editingGoal.id);
                        setIsAddOpen(false);
                      }
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    Удалить цель
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Сохранить</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
