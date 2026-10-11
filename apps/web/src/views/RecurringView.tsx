import React, { useState } from 'react';
import { Repeat, Plus, CheckCircle2, Clock, Trash2, Edit2, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
import { Account, AppStore, Category, Currency, RecurringPayment } from '../types';
import { formatMoney } from '../services/calculations';

interface RecurringViewProps {
  store: AppStore;
  onConfirmPayment: (rec: RecurringPayment) => void;
  onSaveRecurring: (rec: Partial<RecurringPayment>) => void;
  onDeleteRecurring: (id: number) => void;
}

export const RecurringView: React.FC<RecurringViewProps> = ({
  store,
  onConfirmPayment,
  onSaveRecurring,
  onDeleteRecurring,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringPayment | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('UAH');
  const [accountId, setAccountId] = useState<number>(store.accounts[0]?.id || 1);
  const [categoryId, setCategoryId] = useState<number>(store.categories[0]?.id || 1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(15);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [nextDue, setNextDue] = useState(new Date().toISOString().slice(0, 10));
  const [itemType, setItemType] = useState<'expense' | 'income'>('expense');

  const handleOpenAdd = (type: 'expense' | 'income' = 'expense') => {
    setName('');
    setAmount('');
    setCurrency('UAH');
    setAccountId(store.accounts[0]?.id || 1);
    const defaultCat = store.categories.find((c) => (type === 'income' ? c.type === 'income' : c.type === 'expense'));
    setCategoryId(defaultCat?.id || store.categories[0]?.id || 1);
    setDayOfMonth(15);
    setAutoConfirm(false);
    setNextDue(new Date().toISOString().slice(0, 10));
    setItemType(type);
    setEditingItem(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item: RecurringPayment) => {
    setName(item.name);
    setAmount(String(item.amount));
    setCurrency(item.currency);
    setAccountId(item.account_id || store.accounts[0]?.id || 1);
    setCategoryId(item.category_id || store.categories[0]?.id || 1);
    setDayOfMonth(item.day_of_month);
    setAutoConfirm(item.auto_confirm);
    setNextDue(item.next_due);
    setItemType(item.type || 'expense');
    setEditingItem(item);
    setIsAddOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (!name.trim() || isNaN(numAmt) || numAmt <= 0) return;

    onSaveRecurring({
      ...(editingItem ? { id: editingItem.id } : {}),
      name: name.trim(),
      amount: numAmt,
      currency,
      account_id: accountId,
      category_id: categoryId,
      day_of_month: Number(dayOfMonth),
      auto_confirm: autoConfirm,
      next_due: nextDue,
      is_active: true,
      type: itemType,
    });

    setIsAddOpen(false);
  };

  const accMap = new Map(store.accounts.map((a) => [a.id, a.name]));
  const catMap = new Map(store.categories.map((c) => [c.id, c.name]));
  const todayStr = new Date().toISOString().slice(0, 10);

  const recurringPayments = store.recurring_payments.filter((r) => r.type !== 'income');
  const recurringIncomes = store.recurring_payments.filter((r) => r.type === 'income');

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Регулярные платежи и доходы</h2>
          <p className="text-xs text-slate-400">
            Обязательные платежи резервируют средства в Safe-to-spend, а регулярные доходы автоматизируют поступления.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAdd('expense')}
            className="px-3 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Новый платёж</span>
          </button>
          <button
            onClick={() => handleOpenAdd('income')}
            className="px-3 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Регулярный доход</span>
          </button>
        </div>
      </div>

      {/* Section 1: Регулярные обязательные платежи */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <TrendingDown className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-white">Регулярные обязательные платежи</h3>
          <span className="text-xs text-slate-500 font-mono">({recurringPayments.length})</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recurringPayments.map((item) => {
            const isDue = item.next_due <= todayStr;
            const accName = accMap.get(item.account_id || 0) || 'Счёт';
            const catName = catMap.get(item.category_id || 0) || 'Категория';

            return (
              <div
                key={item.id}
                className={`p-5 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                  isDue
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isDue ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        <Repeat className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{item.name}</h4>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.day_of_month}-е число месяца
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1 rounded text-slate-400 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="text-xl font-bold font-mono text-rose-400 tabular-nums">
                      -{formatMoney(item.amount, item.currency)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>{catName}</span>
                      <span>·</span>
                      <span>{accName}</span>
                    </div>
                  </div>

                  <div className="mt-3 p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 text-xs flex items-center justify-between">
                    <span className="text-slate-400">Следующий платёж:</span>
                    <span className={`font-mono font-semibold ${isDue ? 'text-amber-400' : 'text-slate-200'}`}>
                      {item.next_due} {isDue && '(к оплате)'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => onConfirmPayment(item)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Подтвердить оплату</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Удалить регулярный платёж «${item.name}»?`)) {
                        onDeleteRecurring(item.id);
                      }
                    }}
                    className="p-1.5 rounded text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Регулярные доходы */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Регулярные доходы</h3>
          <span className="text-xs text-slate-500 font-mono">({recurringIncomes.length})</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recurringIncomes.map((item) => {
            const isDue = item.next_due <= todayStr;
            const accName = accMap.get(item.account_id || 0) || 'Счёт';
            const catName = catMap.get(item.category_id || 0) || 'Категория';

            return (
              <div
                key={item.id}
                className={`p-5 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                  isDue
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isDue ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        <Repeat className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{item.name}</h4>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.day_of_month}-е число месяца
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1 rounded text-slate-400 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                      +{formatMoney(item.amount, item.currency)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>{catName}</span>
                      <span>·</span>
                      <span>{accName}</span>
                    </div>
                  </div>

                  <div className="mt-3 p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 text-xs flex items-center justify-between">
                    <span className="text-slate-400">Следующее поступление:</span>
                    <span className={`font-mono font-semibold ${isDue ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {item.next_due} {isDue && '(ожидается)'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => onConfirmPayment(item)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Подтвердить поступление</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Удалить регулярный доход «${item.name}»?`)) {
                        onDeleteRecurring(item.id);
                      }
                    }}
                    className="p-1.5 rounded text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">
                {editingItem
                  ? 'Редактировать запись'
                  : itemType === 'income'
                  ? 'Новый регулярный доход'
                  : 'Новый регулярный платёж'}
              </h2>
              <button onClick={() => setIsAddOpen(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Тип записи</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setItemType('expense');
                      const firstExpCat = store.categories.find((c) => c.type === 'expense');
                      if (firstExpCat) setCategoryId(firstExpCat.id);
                    }}
                    className={`py-1.5 rounded-md font-medium transition-colors ${
                      itemType === 'expense'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Обязательный платёж
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItemType('income');
                      const firstIncCat = store.categories.find((c) => c.type === 'income');
                      if (firstIncCat) setCategoryId(firstIncCat.id);
                    }}
                    className={`py-1.5 rounded-md font-medium transition-colors ${
                      itemType === 'income'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Регулярный доход
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Название</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={itemType === 'income' ? 'Например: Зарплата, Аренда...' : 'Например: Аренда, Интернет...'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Сумма</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Счёт</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                  >
                    {store.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Категория</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                  >
                    {store.categories
                      .filter((c) => (itemType === 'income' ? c.type === 'income' : c.type === 'expense'))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">День месяца (1-31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Дата следующей оплаты</label>
                  <input
                    type="date"
                    required
                    value={nextDue}
                    onChange={(e) => setNextDue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
