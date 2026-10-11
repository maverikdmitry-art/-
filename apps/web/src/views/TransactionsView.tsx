import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Calendar,
  Layers,
  Edit2,
  X,
} from 'lucide-react';
import { Account, AppStore, Category, Transaction, TransactionStatus, TransactionType, User } from '../types';
import { formatMoney } from '../services/calculations';

interface TransactionsViewProps {
  store: AppStore;
  selectedUserId: number | 'all';
  onAddTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: number) => void;
  onBulkDelete: (ids: number[]) => void;
  onBulkMarkOk: (ids: number[]) => void;
}

type DatePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'prev_month';

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  store,
  selectedUserId,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onBulkDelete,
  onBulkMarkOk,
}) => {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [userFilter, setUserFilter] = useState<number | 'all'>(selectedUserId);

  useEffect(() => {
    setUserFilter(selectedUserId);
  }, [selectedUserId]);
  const [accountFilter, setAccountFilter] = useState<number | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Sorting state
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Pagination state (10 / 30 / 50 / 100 as per spec)
  const [pageSize, setPageSize] = useState<number>(30);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Maps for quick lookups
  const catMap = useMemo(() => new Map(store.categories.map((c) => [c.id, c.name])), [store.categories]);
  const accMap = useMemo(() => new Map(store.accounts.map((a) => [a.id, a.name])), [store.accounts]);
  const userMap = useMemo(() => new Map(store.users.map((u) => [u.id, u.name])), [store.users]);

  // Date filter boundaries helper
  const isDateInPreset = (isoStr: string, preset: DatePreset): boolean => {
    if (preset === 'all') return true;
    const d = new Date(isoStr);
    const now = new Date();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (preset === 'today') {
      return d >= todayStart;
    }
    if (preset === 'yesterday') {
      return d >= yesterdayStart && d < yesterdayEnd;
    }
    if (preset === 'this_week') {
      const day = now.getDay() || 7; // Monday = 1
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      return d >= weekStart;
    }
    if (preset === 'this_month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (preset === 'prev_month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
    }
    return true;
  };

  // Filtered and Sorted list
  const filteredTransactions = useMemo(() => {
    return store.transactions.filter((tx) => {
      // User filter
      const activeUser = userFilter !== 'all' ? userFilter : selectedUserId !== 'all' ? selectedUserId : 'all';
      if (activeUser !== 'all' && tx.user_id !== activeUser) return false;

      // Account filter
      if (accountFilter !== 'all' && tx.account_id !== accountFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && tx.category_id !== categoryFilter) return false;

      // Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;

      // Source filter
      if (sourceFilter !== 'all' && tx.source !== sourceFilter) return false;

      // Date preset
      if (!isDateInPreset(tx.occurred_at, datePreset)) return false;

      // Search query (search in description and note as per DATABASE.md Section 8)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const noteMatch = (tx.note || '').toLowerCase().includes(q);
        const rawMatch = (tx.raw_text || '').toLowerCase().includes(q);
        if (!descMatch && !noteMatch && !rawMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'date') {
        const diff = new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
        return sortOrder === 'desc' ? diff : -diff;
      } else {
        const diff = Math.abs(b.amount) - Math.abs(a.amount);
        return sortOrder === 'desc' ? diff : -diff;
      }
    });
  }, [
    store.transactions,
    userFilter,
    selectedUserId,
    accountFilter,
    categoryFilter,
    typeFilter,
    statusFilter,
    sourceFilter,
    datePreset,
    searchQuery,
    sortField,
    sortOrder,
  ]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Mass selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(paginatedTransactions.map((tx) => tx.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Review queue counts
  const needsReviewCount = useMemo(
    () => store.transactions.filter((tx) => tx.status === 'needs_review').length,
    [store.transactions]
  );

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
        {/* Row 1: Search & Date Presets */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Поиск по описанию, заметкам или исходному тексту..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date Presets (Сегодня, Вчера, Эта неделя, Этот месяц, Прошлый месяц, Все) */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs scrollbar-none">
            {[
              { id: 'all', label: 'Все даты' },
              { id: 'today', label: 'Сегодня' },
              { id: 'yesterday', label: 'Вчера' },
              { id: 'this_week', label: 'Эта неделя' },
              { id: 'this_month', label: 'Этот месяц' },
              { id: 'prev_month', label: 'Прошлый' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setDatePreset(preset.id as DatePreset);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  datePreset === preset.id
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Secondary Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 text-xs">
          {/* User Filter */}
          <select
            value={userFilter}
            onChange={(e) => {
              setUserFilter(e.target.value === 'all' ? 'all' : Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
          >
            <option value="all">Автор: Все</option>
            {store.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Account Filter */}
          <select
            value={accountFilter}
            onChange={(e) => {
              setAccountFilter(e.target.value === 'all' ? 'all' : Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
          >
            <option value="all">Счёт: Все</option>
            {store.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
          >
            <option value="all">Категория: Все</option>
            {store.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
          >
            <option value="all">Тип: Все</option>
            <option value="expense">Расход</option>
            <option value="income">Доход</option>
            <option value="adjustment">Корректировка</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
          >
            <option value="all">Статус: Все</option>
            <option value="ok">Подтверждено (ok)</option>
            <option value="needs_review">На проверке ({needsReviewCount})</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
          >
            <option value="all">Источник: Все</option>
            <option value="bot">Telegram-бот</option>
            <option value="voice">Голос (Voice)</option>
            <option value="dashboard">Дашборд</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Strip (appears when rows are checked) */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-slate-900 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Выбрано записей: {selectedIds.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onBulkMarkOk(selectedIds);
                setSelectedIds([]);
              }}
              className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Пометить как OK</span>
            </button>
            <button
              onClick={() => {
                if (confirm(`Удалить выбранные операции (${selectedIds.length} шт)?`)) {
                  onBulkDelete(selectedIds);
                  setSelectedIds([]);
                }
              }}
              className="px-3 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Удалить выбранные</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1.5 text-slate-400 hover:text-white"
            >
              Снять выбор
            </button>
          </div>
        </div>
      )}

      {/* Main Transactions Data Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-medium">
                <th className="py-3 pl-4 w-8">
                  <input
                    type="checkbox"
                    checked={
                      paginatedTransactions.length > 0 &&
                      paginatedTransactions.every((tx) => selectedIds.includes(tx.id))
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
                  />
                </th>
                <th
                  onClick={() => {
                    if (sortField === 'date') {
                      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setSortField('date');
                      setSortOrder('desc');
                    }
                  }}
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Дата</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3">Описание и заметка</th>
                <th className="py-3 px-3">Категория</th>
                <th className="py-3 px-3">Счёт</th>
                <th className="py-3 px-3">Автор</th>
                <th className="py-3 px-3">Источник</th>
                <th className="py-3 px-3">Статус</th>
                <th
                  onClick={() => {
                    if (sortField === 'amount') {
                      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setSortField('amount');
                      setSortOrder('desc');
                    }
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Сумма</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 pr-4 text-right w-16">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    Операций не найдено по заданным фильтрам.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const author = userMap.get(tx.user_id) || '—';
                  const catName = catMap.get(tx.category_id || 0) || 'Без категории';
                  const accName = accMap.get(tx.account_id) || '—';
                  const isSelected = selectedIds.includes(tx.id);

                  const dateObj = new Date(tx.occurred_at);
                  const formattedDate = dateObj.toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                  const formattedTime = dateObj.toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-800/40 transition-colors group ${
                        isSelected ? 'bg-slate-800/60' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(tx.id)}
                          className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                        <div>{formattedDate}</div>
                        <div className="text-[10px] text-slate-500">{formattedTime}</div>
                      </td>
                      <td className="py-2.5 px-3 max-w-[240px]">
                        <div className="font-medium text-white truncate">{tx.description}</div>
                        {tx.note && tx.note !== tx.description && (
                          <div className="text-[11px] text-slate-400 truncate">{tx.note}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{catName}</td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{accName}</td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{author}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {tx.source === 'bot' ? 'бот' : tx.source === 'voice' ? 'голос' : 'дашборд'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {tx.status === 'needs_review' ? (
                          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            на проверке
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-400">ok</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold whitespace-nowrap">
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
                      </td>
                      <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            title="Редактировать"
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Удалить операцию «${tx.description}»?`)) {
                                onDeleteTransaction(tx.id);
                              }
                            }}
                            title="Удалить"
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination and page size strip */}
        <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Всего записей: <strong className="text-white font-mono">{filteredTransactions.length}</strong>
            </span>
            <div className="flex items-center gap-1">
              <span>Строк на странице:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-white text-xs font-mono"
              >
                <option value={10}>10</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Страница <strong className="text-white font-mono">{currentPage}</strong> из{' '}
              <strong className="text-white font-mono">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800"
              >
                Назад
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800"
              >
                Вперёд
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
