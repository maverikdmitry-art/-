import React, { useState } from 'react';
import { X, Check, Scale, AlertTriangle } from 'lucide-react';
import { Account, Transaction, User } from '../types';
import { formatMoney } from '../services/calculations';

interface RevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  currentBalance: number;
  users: User[];
  defaultUserId?: number;
  onSaveAdjustment: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => void;
}

export const RevisionModal: React.FC<RevisionModalProps> = ({
  isOpen,
  onClose,
  account,
  currentBalance,
  users,
  defaultUserId = 1,
  onSaveAdjustment,
}) => {
  const [actualBalanceStr, setActualBalanceStr] = useState<string>('');
  const [userId, setUserId] = useState<number>(defaultUserId);
  const [note, setNote] = useState<string>('Ревизия фактического остатка');

  if (!isOpen || !account) return null;

  const actualNum = parseFloat(actualBalanceStr);
  const hasValidActual = !isNaN(actualNum);
  const diff = hasValidActual ? Number((actualNum - currentBalance).toFixed(2)) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasValidActual) return;

    if (diff === 0) {
      alert('Фактический остаток совпадает с расчётным. Корректировка не требуется!');
      onClose();
      return;
    }

    onSaveAdjustment({
      type: 'adjustment',
      amount: diff, // Signed difference according to DATABASE.md
      currency: account.currency,
      account_id: account.id,
      category_id: null,
      user_id: userId,
      description: `Ревизия счёта ${account.name}`,
      note: note.trim() || `Сверка: расчётный ${formatMoney(currentBalance, account.currency)} -> факт ${formatMoney(actualNum, account.currency)}`,
      occurred_at: new Date().toISOString(),
      status: 'ok',
      source: 'dashboard',
      raw_text: null,
      telegram_chat_id: null,
      telegram_message_id: null,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Сверка баланса («Ревизия»)</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
            <div className="text-xs text-slate-400">Счёт: <span className="text-white font-medium">{account.name}</span></div>
            <div className="text-xs text-slate-400">
              Расчётный баланс в системе:{' '}
              <span className="text-white font-mono font-semibold">{formatMoney(currentBalance, account.currency)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Фактический остаток на счёте прямо сейчас ({account.currency})
            </label>
            <input
              type="number"
              step="0.01"
              required
              autoFocus
              placeholder="Введите реальную сумму"
              value={actualBalanceStr}
              onChange={(e) => setActualBalanceStr(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-base focus:outline-none focus:border-emerald-500"
            />
          </div>

          {hasValidActual && (
            <div className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
              diff === 0
                ? 'bg-slate-950 border-slate-800 text-slate-300'
                : diff > 0
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}>
              <span>Будет создана корректировка:</span>
              <span className="font-bold text-sm">
                {diff > 0 ? `+${diff}` : diff} {account.currency}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Кто сверяет</label>
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
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Заметка</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-400 leading-relaxed">
            По спецификации DATABASE.md, ревизия не искажает прошлую историю транзакций, а фиксирует точное расхождение специальной проводкой типа «adjustment».
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
              disabled={!hasValidActual}
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Применить сверку</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
