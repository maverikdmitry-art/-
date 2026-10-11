import React, { useState } from 'react';
import {
  CreditCard,
  Banknote,
  ArrowLeftRight,
  Scale,
  Plus,
  Edit2,
  CheckCircle2,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { Account, AccountKind, AppStore, Currency, Transfer } from '../types';
import { calculateAccountBalance, formatMoney } from '../services/calculations';

interface AccountsViewProps {
  store: AppStore;
  onOpenTransfer: () => void;
  onOpenRevision: (account: Account) => void;
  onSaveAccount: (account: Partial<Account>) => void;
  onDeleteAccount: (id: number) => void;
  onDeleteTransfer: (id: number) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  store,
  onOpenTransfer,
  onOpenRevision,
  onSaveAccount,
  onDeleteAccount,
  onDeleteTransfer,
}) => {
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form fields for Add/Edit Account
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('card');
  const [currency, setCurrency] = useState<Currency>('UAH');
  const [initialBalance, setInitialBalance] = useState('0');

  const handleOpenAdd = () => {
    setName('');
    setKind('card');
    setCurrency('UAH');
    setInitialBalance('0');
    setEditingAccount(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setName(acc.name);
    setKind(acc.kind);
    setCurrency(acc.currency);
    setInitialBalance(String(acc.initial_balance));
    setEditingAccount(acc);
    setIsAddOpen(true);
  };

  const handleSubmitAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSaveAccount({
      ...(editingAccount ? { id: editingAccount.id } : {}),
      name: name.trim(),
      kind,
      currency,
      initial_balance: parseFloat(initialBalance) || 0,
      is_active: true,
      sort_order: editingAccount?.sort_order || store.accounts.length + 1,
    });

    setIsAddOpen(false);
  };

  const accMap = new Map(store.accounts.map((a) => [a.id, a.name]));
  const userMap = new Map(store.users.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Управление счетами и ревизия</h2>
          <p className="text-xs text-slate-400">
            Баланс счёта всегда вычисляется из истории операций и переводов. Удаление траты мгновенно возвращает средства.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTransfer}
            className="px-3.5 py-2 text-xs font-medium text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/30 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Перевод со счёта</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Новый счёт</span>
          </button>
        </div>
      </div>

      {/* Accounts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {store.accounts.map((acc) => {
          const balance = calculateAccountBalance(acc, store.transactions, store.transfers);
          return (
            <div
              key={acc.id}
              className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
                acc.is_active
                  ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/50 border-slate-900 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400">
                    {acc.kind === 'card' ? <CreditCard className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(acc)}
                      className="p-1 rounded text-slate-400 hover:text-white"
                      title="Настройки счёта"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Удалить счёт «${acc.name}»?`)) {
                          onDeleteAccount(acc.id);
                        }
                      }}
                      className="p-1 rounded text-slate-400 hover:text-rose-400"
                      title="Удалить счёт"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-white">{acc.name}</h3>
                  <div className="text-[11px] text-slate-500">
                    {acc.kind === 'card' ? 'Карта' : 'Наличные'} · {acc.currency}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xl font-bold font-mono tracking-tight text-white tabular-nums">
                    {formatMoney(balance, acc.currency)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Стартовый баланс: {formatMoney(acc.initial_balance, acc.currency)}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => onOpenRevision(acc)}
                  className="px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-slate-950 hover:bg-slate-850 rounded border border-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Scale className="w-3 h-3" />
                  <span>Ревизия</span>
                </button>
                <button
                  onClick={onOpenTransfer}
                  className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Перевести
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transfers History Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">История переводов между счетами</h3>
          </div>
          <span className="text-xs text-slate-500">Всего: {store.transfers.length}</span>
        </div>

        {store.transfers.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Переводов между счетами ещё не зафиксировано.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="pb-2.5 pl-2">Дата</th>
                  <th className="pb-2.5">Откуда</th>
                  <th className="pb-2.5">Куда</th>
                  <th className="pb-2.5">Автор</th>
                  <th className="pb-2.5">Заметка</th>
                  <th className="pb-2.5 pr-2 text-right">Сумма</th>
                  <th className="pb-2.5 pr-2 text-right w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {store.transfers.map((tr) => {
                  const fromName = accMap.get(tr.from_account_id) || 'Счёт';
                  const toName = accMap.get(tr.to_account_id) || 'Счёт';
                  const author = userMap.get(tr.user_id) || '—';
                  const dateStr = new Date(tr.occurred_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={tr.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 pl-2 font-mono text-slate-400 whitespace-nowrap">{dateStr}</td>
                      <td className="py-2.5 font-medium text-rose-300">{fromName}</td>
                      <td className="py-2.5 font-medium text-emerald-300">{toName}</td>
                      <td className="py-2.5 text-slate-400">{author}</td>
                      <td className="py-2.5 text-slate-400">{tr.note || '—'}</td>
                      <td className="py-2.5 pr-2 text-right font-mono font-semibold text-white whitespace-nowrap">
                        {formatMoney(tr.amount_from)}
                        {tr.amount_from !== tr.amount_to && (
                          <span className="text-slate-400 text-[11px] block">
                            (зачислено {formatMoney(tr.amount_to)})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        <button
                          onClick={() => {
                            if (confirm('Удалить запись о переводе? Балансы счетов будут пересчитаны.')) {
                              onDeleteTransfer(tr.id);
                            }
                          }}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                          title="Удалить перевод"
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

      {/* Add / Edit Account Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">
                {editingAccount ? 'Редактировать счёт' : 'Создать новый счёт'}
              </h2>
              <button onClick={() => setIsAddOpen(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Название счёта</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Например: Монобанк, Райффайзен, Наличка..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Тип счёта</label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as AccountKind)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                  >
                    <option value="card">Карта (card)</option>
                    <option value="cash">Наличные (cash)</option>
                  </select>
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

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Стартовый баланс (initial_balance)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                {editingAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Удалить счёт «${editingAccount.name}»?`)) {
                        onDeleteAccount(editingAccount.id);
                        setIsAddOpen(false);
                      }
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    Удалить счёт
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
