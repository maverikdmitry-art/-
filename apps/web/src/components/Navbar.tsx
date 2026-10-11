import React from 'react';
import { User, Wallet, Sparkles, Plus, AlertCircle, Bot } from 'lucide-react';
import { AppStore } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  selectedUserId: number | 'all';
  setSelectedUserId: (userId: number | 'all') => void;
  store: AppStore;
  onOpenQuickAdd: () => void;
  onOpenQuickBot: () => void;
  needsReviewCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  selectedUserId,
  setSelectedUserId,
  store,
  onOpenQuickAdd,
  onOpenQuickBot,
  needsReviewCount,
}) => {
  const tabs = [
    { id: 'overview', label: 'Обзор' },
    { id: 'income', label: 'Доходы' },
    { id: 'transactions', label: 'Транзакции', badge: needsReviewCount > 0 ? needsReviewCount : null },
    { id: 'board', label: 'Борд' },
    { id: 'calendar', label: 'Календарь' },
    { id: 'accounts', label: 'Счета & Ревизия' },
    { id: 'goals', label: 'Цели' },
    { id: 'recurring', label: 'Регулярные' },
    { id: 'categories', label: 'Категории' },
    { id: 'bot', label: 'Telegram-Бот' },
    { id: 'settings', label: 'Настройки' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Wordmark + Context Filter */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => setCurrentTab('overview')}
              className="flex items-center gap-2.5 text-left focus:outline-none group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
                OoverFinancee
              </span>
            </button>

            {/* Filter by User: Все / Дмитро / Даша as specified in DATABASE.md */}
            <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setSelectedUserId('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  selectedUserId === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Все
              </button>
              {store.users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    selectedUserId === u.id
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1 overflow-x-auto py-1">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`relative px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'text-white bg-slate-800/80 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {tab.label}
                  {tab.badge && (
                    <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Quick Bot Entry */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Quick Bot / Natural Language shortcut */}
            <button
              onClick={onOpenQuickBot}
              title="Быстрый ввод через парсер бота"
              className="px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Быстрая операция</span>
            </button>

            {/* Primary Action Button */}
            <button
              onClick={onOpenQuickAdd}
              className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>операция</span>
            </button>
          </div>
        </div>

        {/* Mobile secondary tab strip */}
        <div className="xl:hidden flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-900 -mx-4 px-4 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'text-white bg-slate-800'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
                {tab.badge && (
                  <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 text-[10px] flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
