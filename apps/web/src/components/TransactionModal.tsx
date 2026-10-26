import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Account, Category, Currency, Transaction, TransactionStatus, TransactionType, User } from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Partial<Transaction>) => void;
  initialData?: Transaction | null;
  accounts: Account[];
  categories: Category[];
  users: User[];
  defaultUserId?: number;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  accounts,
  categories,
  users,
  defaultUserId = 1,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>('UAH');
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id || 1);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [userId, setUserId] = useState<number>(defaultUserId);
  const [description, setDescription] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState<string>(new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState<TransactionStatus>('ok');

  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAmount(String(Math.abs(initialData.amount)));
      setCurrency(initialData.currency);
      setAccountId(initialData.account_id);
      setCategoryId(initialData.category_id || undefined);
      setUserId(initialData.user_id);
      setDescription(initialData.description || '');
      setNote(initialData.note || '');
      setOccurredAt(initialData.occurred_at ? initialData.occurred_at.slice(0, 16) : new Date().toISOString().slice(0, 16));
      setStatus(initialData.status);
    } else {
      setType('expense');
      setAmount('');
      setCurrency('UAH');
      setAccountId(accounts[0]?.id || 1);
      setCategoryId(categories.find((c) => c.type === 'expense')?.id);
      setUserId(defaultUserId);
      setDescription('');
      setNote('');
      setOccurredAt(new Date().toISOString().slice(0, 16));
      setStatus('ok');
    }
  }, [initialData, isOpen, accounts, categories, defaultUserId]);

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) => c.is_active && (type === 'adjustment' || c.type === type));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[TransactionModal] handleSubmit', { amount, accountId, userId, accounts: accounts.length });
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount === 0) {
      console.warn('[TransactionModal] blocked: invalid amount');
      return;
    }

    // Убедимся, что счёт существует (иначе FK-нарушение на account_id)
    const validAccountId =
      accounts.find((a) => a.id === accountId)?.id ??
      accounts.find((a) => a.is_active)?.id ??
      accounts[0]?.id;
    if (!validAccountId) {
      console.error('[TransactionModal] no accounts available');
      return;
    }

    const finalAmount = type === 'adjustment' ? numAmount : Math.abs(numAmount);

    let occurredIso: string;
    try {
      const d = new Date(occurredAt);
      if (isNaN(d.getTime())) throw new Error('invalid date');
      occurredIso = d.toISOString();
    } catch {
      occurredIso = new Date().toISOString();
    }

    onSave({
      ...(initialData?.id ? { id: initialData.id } : {}),
      type,
      amount: finalAmount,
      currency,
      account_id: validAccountId,
      category_id: categoryId || null,
      user_id: userId,
      description: description.trim() || (type === 'income' ? 'Доход' : type === 'adjustment' ? 'Корректировка' : 'Расход'),
      note: note.trim(),
      occurred_at: occurredIso,
      status,
      source: initialData?.source || 'dashboard',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">
            {initialData ? 'Редактировать операцию' : 'Новая финансовая операция'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Operation Type Tabs */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Тип операции</label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setType('expense');
                  const firstCat = categories.find((c) => c.type === 'expense');
                  if (firstCat) setCategoryId(firstCat.id);
                }}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  type === 'expense'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Расход
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('income');
                  const firstCat = categories.find((c) => c.type === 'income');
                  if (firstCat) setCategoryId(firstCat.id);
                }}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  type === 'income'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Доход
              </button>
              <button
                type="button"
                onClick={() => setType('adjustment')}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  type === 'adjustment'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Корректировка
              </button>
            </div>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Сумма {type === 'adjustment' && '(со знаком +/-)'}
              </label>
              <input
                type="number"
                step="0.01"
                required
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-base focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Валюта</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="UAH">UAH (₴)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          {/* Account & Author */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Счёт списания / пополнения</label>
              <select
                value={accountId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setAccountId(id);
                  const acc = accounts.find((a) => a.id === id);
                  if (acc) setCurrency(acc.currency);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                {accounts.filter((a) => a.is_active).map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Кто совершил (Автор)</label>
              <select
                value={userId}
                onChange={(e) => setUserId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          {type !== 'adjustment' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Категория</label>
              <select
                value={categoryId || ''}
                onChange={(e) => setCategoryId(Number(e.target.value) || undefined)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="">Без категории</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description & Note */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Описание</label>
            <input
              type="text"
              placeholder="Например: Супермаркет Сильпо, Кофе в дорогу..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Комментарий / Заметка</label>
            <input
              type="text"
              placeholder="Детали, поиск по чеку..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Date & Review Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Дата и время</label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Статус проверки</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="ok">Подтверждено (ok)</option>
                <option value="needs_review">Требует разбора (needs_review)</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Сохранить</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
