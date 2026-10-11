import React, { useState, useMemo } from 'react';
import { Layers, Plus, CheckCircle2, AlertTriangle, User } from 'lucide-react';
import { AppStore, Transaction } from '../types';
import { formatMoney } from '../services/calculations';

interface BoardViewProps {
  store: AppStore;
  selectedUserId: number | 'all';
  onEditTransaction: (tx: Transaction) => void;
  onAddTransaction: () => void;
}

type GroupByMode = 'group' | 'user' | 'status';

export const BoardView: React.FC<BoardViewProps> = ({
  store,
  selectedUserId,
  onEditTransaction,
  onAddTransaction,
}) => {
  const [groupBy, setGroupBy] = useState<GroupByMode>('group');

  const catMap = useMemo(() => new Map(store.categories.map((c) => [c.id, c])), [store.categories]);
  const groupMap = useMemo(() => new Map(store.category_groups.map((g) => [g.id, g.name])), [store.category_groups]);
  const accMap = useMemo(() => new Map(store.accounts.map((a) => [a.id, a.name])), [store.accounts]);
  const userMap = useMemo(() => new Map(store.users.map((u) => [u.id, u.name])), [store.users]);

  // Filtered by selected user if not 'all'
  const visibleTransactions = useMemo(() => {
    return store.transactions.filter((tx) =>
      selectedUserId === 'all' ? true : tx.user_id === selectedUserId
    );
  }, [store.transactions, selectedUserId]);

  // Build Kanban Columns based on groupBy
  const columns = useMemo(() => {
    if (groupBy === 'group') {
      return store.category_groups.map((grp) => {
        const txs = visibleTransactions.filter((tx) => {
          const cat = catMap.get(tx.category_id || 0);
          return cat ? cat.group_id === grp.id : grp.name === 'Необязательные';
        });
        const total = txs.reduce((sum, tx) => {
          const amt = tx.currency === 'USD' ? tx.amount * store.settings.usd_rate : tx.amount;
          return sum + (tx.type === 'expense' ? amt : tx.type === 'income' ? -amt : 0);
        }, 0);

        return {
          id: String(grp.id),
          title: grp.name,
          subtitle: `${txs.length} операций`,
          totalFormatted: formatMoney(Math.abs(total)),
          transactions: txs,
        };
      });
    }

    if (groupBy === 'user') {
      return store.users.map((usr) => {
        const txs = visibleTransactions.filter((tx) => tx.user_id === usr.id);
        const totalExpense = txs
          .filter((tx) => tx.type === 'expense')
          .reduce((sum, tx) => {
            const amt = tx.currency === 'USD' ? tx.amount * store.settings.usd_rate : tx.amount;
            return sum + amt;
          }, 0);

        return {
          id: String(usr.id),
          title: usr.name,
          subtitle: `${txs.length} операций`,
          totalFormatted: `Траты: ${formatMoney(totalExpense)}`,
          transactions: txs,
        };
      });
    }

    // groupBy === 'status'
    const okTxs = visibleTransactions.filter((tx) => tx.status === 'ok');
    const reviewTxs = visibleTransactions.filter((tx) => tx.status === 'needs_review');

    return [
      {
        id: 'needs_review',
        title: 'Требует проверки',
        subtitle: `${reviewTxs.length} операций`,
        totalFormatted: 'Очередь разбора',
        transactions: reviewTxs,
      },
      {
        id: 'ok',
        title: 'Подтверждено',
        subtitle: `${okTxs.length} операций`,
        totalFormatted: 'Учтено в балансе',
        transactions: okTxs,
      },
    ];
  }, [groupBy, visibleTransactions, store.category_groups, store.users, catMap, store.settings.usd_rate]);

  return (
    <div className="space-y-4">
      {/* Board Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Канбан-борд операций</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Группировка:</span>
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setGroupBy('group')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                groupBy === 'group'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              По группам категорий
            </button>
            <button
              onClick={() => setGroupBy('user')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                groupBy === 'user'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              По авторам (Дмитро / Даша)
            </button>
            <button
              onClick={() => setGroupBy('status')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                groupBy === 'status'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              По статусу проверки
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Column Lanes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {columns.map((col) => (
          <div
            key={col.id}
            className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col max-h-[750px]"
          >
            {/* Column Header */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{col.title}</h3>
                <div className="text-[11px] text-slate-400">{col.subtitle}</div>
              </div>
              <div className="text-xs font-mono font-semibold text-slate-300">
                {col.totalFormatted}
              </div>
            </div>

            {/* Column Cards */}
            <div className="p-3 space-y-2.5 overflow-y-auto flex-1">
              {col.transactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Нет операций в этой колонке
                </div>
              ) : (
                col.transactions.map((tx) => {
                  const cat = catMap.get(tx.category_id || 0);
                  const acc = accMap.get(tx.account_id);
                  const author = userMap.get(tx.user_id);
                  const dateStr = new Date(tx.occurred_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <div
                      key={tx.id}
                      onClick={() => onEditTransaction(tx)}
                      className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-lg transition-all cursor-pointer shadow-xs group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-xs text-white group-hover:text-emerald-300 transition-colors">
                          {tx.description}
                        </div>
                        <div className="text-xs font-mono font-bold whitespace-nowrap">
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
                        </div>
                      </div>

                      {tx.note && tx.note !== tx.description && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{tx.note}</p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{cat?.name || 'Без категории'}</span>
                          <span>·</span>
                          <span>{acc || 'Счёт'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>{author}</span>
                          <span>·</span>
                          <span className="font-mono text-slate-500">{dateStr}</span>
                        </div>
                      </div>

                      {tx.status === 'needs_review' && (
                        <div className="mt-2 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 inline-block">
                          требует проверки
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
