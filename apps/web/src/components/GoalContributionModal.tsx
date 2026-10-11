import React, { useState } from 'react';
import { X, Check, Target } from 'lucide-react';
import { Goal, GoalContribution, User } from '../types';
import { formatMoney } from '../services/calculations';

interface GoalContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  currentSaved: number;
  users: User[];
  defaultUserId?: number;
  onSave: (contribution: Omit<GoalContribution, 'id' | 'created_at'>) => void;
}

export const GoalContributionModal: React.FC<GoalContributionModalProps> = ({
  isOpen,
  onClose,
  goal,
  currentSaved,
  users,
  defaultUserId = 1,
  onSave,
}) => {
  const [actionType, setActionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amountStr, setAmountStr] = useState<string>('');
  const [userId, setUserId] = useState<number>(defaultUserId);

  if (!isOpen || !goal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amountStr);
    if (isNaN(num) || num <= 0) return;

    const finalAmount = actionType === 'deposit' ? num : -num;

    onSave({
      goal_id: goal.id,
      amount: finalAmount,
      user_id: userId,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Взнос / Снятие с цели</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">Цель: <span className="text-white font-medium">{goal.name}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Целевая сумма: <span className="text-white font-mono">{formatMoney(goal.target_amount, goal.currency)}</span></span>
              <span>Накоплено: <span className="text-emerald-400 font-mono font-semibold">{formatMoney(currentSaved, goal.currency)}</span></span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Действие</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setActionType('deposit')}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  actionType === 'deposit'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                + Пополнить копилку
              </button>
              <button
                type="button"
                onClick={() => setActionType('withdraw')}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  actionType === 'withdraw'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                − Снять накопления
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Сумма ({goal.currency})
            </label>
            <input
              type="number"
              step="0.01"
              required
              autoFocus
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-base focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Кто совершил</label>
            <select
              value={userId}
              onChange={(e) => setUserId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{actionType === 'deposit' ? 'Внести взнос' : 'Снять средства'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
