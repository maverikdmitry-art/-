import React, { useState } from 'react';
import { X, ArrowRight, Check } from 'lucide-react';
import { Account, Transfer, User } from '../types';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transfer: Omit<Transfer, 'id'>) => void;
  accounts: Account[];
  users: User[];
  usdRate: number;
  defaultUserId?: number;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  onSave,
  accounts,
  users,
  usdRate,
  defaultUserId = 1,
}) => {
  const activeAccounts = accounts.filter((a) => a.is_active);
  const [fromAccountId, setFromAccountId] = useState<number>(activeAccounts[0]?.id || 1);
  const [toAccountId, setToAccountId] = useState<number>(activeAccounts[1]?.id || 2);
  const [amountFrom, setAmountFrom] = useState<string>('');
  const [amountTo, setAmountTo] = useState<string>('');
  const [userId, setUserId] = useState<number>(defaultUserId);
  const [note, setNote] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState<string>(new Date().toISOString().slice(0, 16));

  if (!isOpen) return null;

  const fromAcc = accounts.find((a) => a.id === fromAccountId);
  const toAcc = accounts.find((a) => a.id === toAccountId);

  const handleAmountFromChange = (val: string) => {
    setAmountFrom(val);
    const num = parseFloat(val);
    if (!isNaN(num) && fromAcc && toAcc) {
      if (fromAcc.currency === toAcc.currency) {
        setAmountTo(val);
      } else if (fromAcc.currency === 'UAH' && toAcc.currency === 'USD') {
        setAmountTo((num / usdRate).toFixed(2));
      } else if (fromAcc.currency === 'USD' && toAcc.currency === 'UAH') {
        setAmountTo((num * usdRate).toFixed(2));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromAccountId === toAccountId) {
      alert('Счета списания и зачисления должны различаться.');
      return;
    }
    const numFrom = parseFloat(amountFrom);
    const numTo = parseFloat(amountTo);
    if (isNaN(numFrom) || numFrom <= 0 || isNaN(numTo) || numTo <= 0) return;

    onSave({
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount_from: numFrom,
      amount_to: numTo,
      user_id: userId,
      note: note.trim() || 'Перевод между счетами',
      occurred_at: new Date(occurredAt).toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">Перевод между счетами</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Откуда списать</label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === toAccountId}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Куда зачислить</label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === fromAccountId}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Сумма списания ({fromAcc?.currency})
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amountFrom}
                onChange={(e) => handleAmountFromChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Сумма зачисления ({toAcc?.currency})
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amountTo}
                onChange={(e) => setAmountTo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-sm"
              />
            </div>
          </div>

          {fromAcc?.currency !== toAcc?.currency && (
            <p className="text-xs text-slate-400">
              Конвертация по текущему курсу: 1 USD = {usdRate} UAH. Можно скорректировать вручную.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Дата и время</label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Комментарий</label>
            <input
              type="text"
              placeholder="Например: Снятие налички в банкомате, Обмен валюты..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
            />
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
              <span>Выполнить перевод</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
