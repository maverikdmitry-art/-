import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewView } from './views/OverviewView';
import { TransactionsView } from './views/TransactionsView';
import { BoardView } from './views/BoardView';
import { CalendarView } from './views/CalendarView';
import { AccountsView } from './views/AccountsView';
import { GoalsView } from './views/GoalsView';
import { RecurringView } from './views/RecurringView';
import { CategoriesView } from './views/CategoriesView';
import { BotSimulatorView } from './views/BotSimulatorView';
import { SettingsView } from './views/SettingsView';
import { IncomeView } from './views/IncomeView';

import { TransactionModal } from './components/TransactionModal';
import { TransferModal } from './components/TransferModal';
import { RevisionModal } from './components/RevisionModal';
import { GoalContributionModal } from './components/GoalContributionModal';
import { QuickBotInputModal } from './components/QuickBotInputModal';
import { AuthGate } from './components/AuthGate';

import { exportBackupJson, exportTransactionsCsv } from './services/storage';
import { isSupabaseConfigured } from './services/supabaseClient';
import { getSession, onAuthChange, signOut } from './services/auth';
import * as data from './services/data';
import { Account, AppSettings, AppStore, Category, CategoryGroup, Goal, GoalContribution, RecurringPayment, Transaction, Transfer } from './types';
import { calculateAccountBalance } from './services/calculations';
import { Bell, CheckCircle2, LogOut, Loader2 } from 'lucide-react';

/**
 * Корневой компонент дашборда.
 *
 * Данные — единственный источник правды Supabase (см. services/data.ts).
 * Views работают с готовым объектом `AppStore` в памяти; все мутации —
 * асинхронные обращения к Supabase, после которых store перечитывается.
 * Доступ только для авторизованных (RLS), поэтому при отсутствии сессии
 * показываем экран входа (AuthGate).
 */
export default function App() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [store, setStore] = useState<AppStore | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [selectedUserId, setSelectedUserId] = useState<number | 'all'>('all');

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [revisionAccount, setRevisionAccount] = useState<Account | null>(null);
  const [goalDepositGoal, setGoalDepositGoal] = useState<Goal | null>(null);
  const [isQuickBotModalOpen, setIsQuickBotModalOpen] = useState(false);

  // Partner / Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 4500);
  };

  // Перечитать store из Supabase.
  const reload = useCallback(async () => {
    try {
      setLoadError(null);
      const next = await data.loadStore();
      setStore(next);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить данные.');
    }
  }, []);

  // Проверка сессии при монтировании + подписка на изменения.
  useEffect(() => {
    let active = true;
    getSession().then((session) => {
      if (!active) return;
      setAuthed(Boolean(session));
      setSessionChecked(true);
    });
    const unsubscribe = onAuthChange((session) => {
      setAuthed(Boolean(session));
      if (!session) setStore(null);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Загружаем данные после входа.
  useEffect(() => {
    if (authed && isSupabaseConfigured()) {
      void reload();
    }
  }, [authed, reload]);

  // Экран входа, если нет сессии.
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!authed || !isSupabaseConfigured()) {
    return <AuthGate configured={isSupabaseConfigured()} />;
  }

  // Загрузка / ошибка данных.
  if (!store) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex flex-col items-center justify-center gap-3 p-4">
        {loadError ? (
          <>
            <p className="text-rose-300 text-sm">Ошибка загрузки данных.</p>
            <p className="text-xs text-slate-500 max-w-md text-center">{loadError}</p>
            <button
              onClick={() => void reload()}
              className="mt-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
            >
              Повторить
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Загрузка данных…
          </div>
        )}
      </div>
    );
  }


  // Выполнить асинхронную мутацию в Supabase, перечитать store и показать тост.
  const run = async (action: () => Promise<void>, successMessage: string) => {
    try {
      await action();
      await reload();
      showToast(successMessage);
    } catch (err) {
      showToast(`❌ ${err instanceof Error ? err.message : 'Ошибка сохранения'}`);
    }
  };

  // --- Transactions Handlers ---
  const handleSaveTransaction = (txData: Partial<Transaction>) => {
    void run(() => data.saveTransaction(txData), 'Операция успешно сохранена');
  };

  const handleDeleteTransaction = (id: number) => {
    void run(() => data.deleteTransaction(id), 'Операция удалена. Баланс счёта пересчитан.');
  };

  const handleBulkDelete = (ids: number[]) => {
    void run(() => data.bulkDeleteTransactions(ids), `Удалено операций: ${ids.length}`);
  };

  const handleBulkMarkOk = (ids: number[]) => {
    void run(() => data.bulkMarkOk(ids), `Операции (${ids.length} шт) подтверждены`);
  };


  // --- Transfers Handlers ---
  const handleSaveTransfer = (transferData: Omit<Transfer, 'id'>) => {
    void run(() => data.saveTransfer(transferData), 'Перевод между счетами выполнен');
  };

  const handleDeleteTransfer = (id: number) => {
    void run(() => data.deleteTransfer(id), 'Перевод удалён');
  };

  // --- Revision / Adjustment Handler ---
  const handleSaveAdjustment = (adjData: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
    void run(
      () => data.saveTransaction({ ...adjData, type: 'adjustment' }),
      'Сверка баланса зафиксирована корректирующей проводкой'
    );
  };

  // --- Goals Handlers ---
  const handleSaveGoalContribution = (contribData: Omit<GoalContribution, 'id' | 'created_at'>) => {
    void run(
      () => data.saveContribution(contribData),
      contribData.amount >= 0 ? 'Взнос в цель зафиксирован' : 'Снятие с цели зафиксировано'
    );
  };

  const handleSaveGoal = (goalData: Partial<Goal>) => {
    void run(() => data.saveGoal(goalData), 'Цель сохранена');
  };

  const handleDeleteGoal = (id: number) => {
    void run(() => data.deleteGoal(id), 'Цель удалена');
  };

  const handleDeleteContribution = (id: number) => {
    void run(() => data.deleteContribution(id), 'Запись о взносе удалена');
  };


  // --- Recurring Handlers ---
  const handleConfirmRecurringPayment = (rec: RecurringPayment) => {
    const userId = selectedUserId !== 'all' ? selectedUserId : (store.users[0]?.id ?? 1);
    void run(
      () => data.confirmRecurringPayment(rec, userId),
      rec.type === 'income'
        ? `Доход «${rec.name}» подтвержден и зачислен`
        : `Платёж «${rec.name}» подтверждён и сдвинут на следующий месяц`
    );
  };

  const handleSaveRecurring = (recData: Partial<RecurringPayment>) => {
    void run(
      () => data.saveRecurring(recData),
      recData.type === 'income' ? 'Регулярный доход сохранён' : 'Регулярный платёж сохранён'
    );
  };

  const handleDeleteRecurring = (id: number) => {
    void run(() => data.deleteRecurring(id), 'Регулярный платёж удалён');
  };

  // --- Accounts Handlers ---
  const handleSaveAccount = (accData: Partial<Account>) => {
    void run(() => data.saveAccount(accData), 'Счёт сохранён');
  };

  const handleDeleteAccount = (id: number) => {
    void run(() => data.deleteAccount(id), 'Счёт удалён');
  };

  // --- Categories Handlers ---
  const handleSaveCategory = (catData: Partial<Category>) => {
    void run(() => data.saveCategory(catData), 'Категория сохранена');
  };

  const handleDeleteCategory = (id: number) => {
    void run(() => data.deleteCategory(id), 'Категория удалена');
  };

  const handleSaveGroup = (grpData: Partial<CategoryGroup>) => {
    void run(() => data.saveGroup(grpData), 'Группа сохранена');
  };

  // --- Settings Handlers ---
  const handleUpdateSettings = (newSettings: AppSettings) => {
    void run(() => data.saveSettings(newSettings), 'Настройки обновлены');
  };


  // Export functions (browser download trigger)
  const handleExportBackup = () => {
    const jsonStr = exportBackupJson(store);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ooverfinancee_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Резервная копия скачана');
  };

  const handleExportCsv = () => {
    const csvStr = exportTransactionsCsv(store);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ooverfinancee_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV файл экспортирован');
  };

  const handleImportBackup = (jsonContent: string) => {
    try {
      const parsed = JSON.parse(jsonContent) as AppStore;
      if (parsed.accounts && parsed.transactions && parsed.settings) {
        void run(
          () => data.importStore(parsed),
          'База данных успешно восстановлена из бэкапа'
        );
      } else {
        alert('Некорректная структура файла бэкапа.');
      }
    } catch (e) {
      alert('Ошибка при чтении JSON файла бэкапа.');
    }
  };

  const handleClearTestData = () => {
    void run(
      () => data.clearTestData(),
      'Тестовые транзакции очищены. Счета и настройки сохранены.'
    );
  };

  const handleResetDefaults = () => {
    void run(
      () => data.resetToDefaults(),
      'Операции удалены, настройки сброшены к значениям по умолчанию.'
    );
  };

  const handleUpdateNextIncomeDate = (newDate: string) => {
    void run(() => data.updateNextIncomeDate(newDate), 'Дата следующего дохода обновлена');
  };

  const needsReviewCount = store.transactions.filter((tx) => tx.status === 'needs_review').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <div className="relative">
        <Navbar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          selectedUserId={selectedUserId}
          setSelectedUserId={setSelectedUserId}
          store={store}
          onOpenQuickAdd={() => {
            setEditingTx(null);
            setIsTxModalOpen(true);
          }}
          onOpenQuickBot={() => setIsQuickBotModalOpen(true)}
          needsReviewCount={needsReviewCount}
        />
        <button
          onClick={() => void signOut()}
          title="Выйти из аккаунта"
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'overview' && (
          <OverviewView
            store={store}
            selectedUserId={selectedUserId}
            onNavigateTab={setCurrentTab}
            onOpenQuickAdd={() => {
              setEditingTx(null);
              setIsTxModalOpen(true);
            }}
            onOpenQuickBot={() => setIsQuickBotModalOpen(true)}
            onOpenTransfer={() => setIsTransferModalOpen(true)}
            onOpenRevision={(acc) => setRevisionAccount(acc)}
            onOpenGoalDeposit={(goal) => setGoalDepositGoal(goal)}
            onConfirmRecurring={handleConfirmRecurringPayment}
            onEditTransaction={(tx) => {
              setEditingTx(tx);
              setIsTxModalOpen(true);
            }}
          />
        )}

        {currentTab === 'income' && (
          <IncomeView
            store={store}
            onAddTransaction={() => {
              setEditingTx(null);
              setIsTxModalOpen(true);
            }}
            onEditTransaction={(tx) => {
              setEditingTx(tx);
              setIsTxModalOpen(true);
            }}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateNextIncomeDate={handleUpdateNextIncomeDate}
          />
        )}

        {currentTab === 'transactions' && (
          <TransactionsView
            store={store}
            selectedUserId={selectedUserId}
            onAddTransaction={() => {
              setEditingTx(null);
              setIsTxModalOpen(true);
            }}
            onEditTransaction={(tx) => {
              setEditingTx(tx);
              setIsTxModalOpen(true);
            }}
            onDeleteTransaction={handleDeleteTransaction}
            onBulkDelete={handleBulkDelete}
            onBulkMarkOk={handleBulkMarkOk}
          />
        )}

        {currentTab === 'board' && (
          <BoardView
            store={store}
            selectedUserId={selectedUserId}
            onEditTransaction={(tx) => {
              setEditingTx(tx);
              setIsTxModalOpen(true);
            }}
            onAddTransaction={() => {
              setEditingTx(null);
              setIsTxModalOpen(true);
            }}
          />
        )}

        {currentTab === 'calendar' && (
          <CalendarView
            store={store}
            selectedUserId={selectedUserId}
            onEditTransaction={(tx) => {
              setEditingTx(tx);
              setIsTxModalOpen(true);
            }}
            onAddTransaction={() => {
              setEditingTx(null);
              setIsTxModalOpen(true);
            }}
          />
        )}

        {currentTab === 'accounts' && (
          <AccountsView
            store={store}
            onOpenTransfer={() => setIsTransferModalOpen(true)}
            onOpenRevision={(acc) => setRevisionAccount(acc)}
            onSaveAccount={handleSaveAccount}
            onDeleteAccount={handleDeleteAccount}
            onDeleteTransfer={handleDeleteTransfer}
          />
        )}

        {currentTab === 'goals' && (
          <GoalsView
            store={store}
            onOpenDeposit={(goal) => setGoalDepositGoal(goal)}
            onSaveGoal={handleSaveGoal}
            onDeleteGoal={handleDeleteGoal}
            onDeleteContribution={handleDeleteContribution}
          />
        )}

        {currentTab === 'recurring' && (
          <RecurringView
            store={store}
            onConfirmPayment={handleConfirmRecurringPayment}
            onSaveRecurring={handleSaveRecurring}
            onDeleteRecurring={handleDeleteRecurring}
          />
        )}

        {currentTab === 'categories' && (
          <CategoriesView
            store={store}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            onSaveGroup={handleSaveGroup}
          />
        )}

        {currentTab === 'bot' && (
          <BotSimulatorView
            store={store}
            onSaveTransaction={handleSaveTransaction}
            onPartnerNotification={(txt) => showToast(txt)}
            onExportBackup={handleExportBackup}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            store={store}
            onUpdateSettings={handleUpdateSettings}
            onExportCsv={handleExportCsv}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onClearTestData={handleClearTestData}
            onResetDefaults={handleResetDefaults}
          />
        )}
      </main>

      {/* Floating Partner Notification / Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div className="bg-slate-900 border border-emerald-500/40 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Modals */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        onSave={handleSaveTransaction}
        initialData={editingTx}
        accounts={store.accounts}
        categories={store.categories}
        users={store.users}
        defaultUserId={selectedUserId !== 'all' ? selectedUserId : (store.users[0]?.id ?? 1)}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSave={handleSaveTransfer}
        accounts={store.accounts}
        users={store.users}
        usdRate={store.settings.usd_rate}
        defaultUserId={selectedUserId !== 'all' ? selectedUserId : (store.users[0]?.id ?? 1)}
      />

      {revisionAccount && (
        <RevisionModal
          isOpen={Boolean(revisionAccount)}
          onClose={() => setRevisionAccount(null)}
          account={revisionAccount}
          currentBalance={calculateAccountBalance(revisionAccount, store.transactions, store.transfers)}
          users={store.users}
          defaultUserId={selectedUserId !== 'all' ? selectedUserId : (store.users[0]?.id ?? 1)}
          onSaveAdjustment={handleSaveAdjustment}
        />
      )}

      {goalDepositGoal && (
        <GoalContributionModal
          isOpen={Boolean(goalDepositGoal)}
          onClose={() => setGoalDepositGoal(null)}
          goal={goalDepositGoal}
          currentSaved={store.goal_contributions
            .filter((c) => c.goal_id === goalDepositGoal.id)
            .reduce((sum, c) => sum + (c.amount || 0), 0)}
          users={store.users}
          defaultUserId={selectedUserId !== 'all' ? selectedUserId : (store.users[0]?.id ?? 1)}
          onSave={handleSaveGoalContribution}
        />
      )}

      <QuickBotInputModal
        isOpen={isQuickBotModalOpen}
        onClose={() => setIsQuickBotModalOpen(false)}
        accounts={store.accounts}
        categories={store.categories}
        users={store.users}
        defaultUserId={selectedUserId !== 'all' ? selectedUserId : (store.users[0]?.id ?? 1)}
        lastUsedAccountId={store.transactions[0]?.account_id}
        onSaveTransaction={handleSaveTransaction}
        onPartnerNotification={(txt) => showToast(txt)}
        confirmEnabled={store.settings.confirm_enabled}
      />
    </div>
  );
}
