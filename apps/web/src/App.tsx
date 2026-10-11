import React, { useState, useEffect } from 'react';
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

import {
  clearTestDataOnly,
  exportBackupJson,
  exportTransactionsCsv,
  loadStore,
  resetToDefaults,
  saveStore,
} from './services/storage';
import { Account, AppSettings, AppStore, Category, CategoryGroup, Goal, GoalContribution, RecurringPayment, Transaction, Transfer } from './types';
import { calculateAccountBalance } from './services/calculations';
import { Bell, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [store, setStore] = useState<AppStore>(() => loadStore());
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

  // Sync state to LocalStorage
  const updateStore = (updater: (prev: AppStore) => AppStore) => {
    setStore((prev) => {
      const next = updater(prev);
      saveStore(next);
      return next;
    });
  };

  // --- Transactions Handlers ---
  const handleSaveTransaction = (txData: Partial<Transaction>) => {
    updateStore((prev) => {
      if (txData.id) {
        // Edit existing
        const updated = prev.transactions.map((t) =>
          t.id === txData.id
            ? ({
                ...t,
                ...txData,
                updated_at: new Date().toISOString(),
              } as Transaction)
            : t
        );
        return { ...prev, transactions: updated };
      } else {
        // Create new
        const newId = prev.transactions.length > 0 ? Math.max(...prev.transactions.map((t) => t.id)) + 1 : 1;
        const newTx: Transaction = {
          id: newId,
          type: txData.type || 'expense',
          amount: txData.amount || 0,
          currency: txData.currency || 'UAH',
          account_id: txData.account_id || prev.accounts[0]?.id || 1,
          category_id: txData.category_id || null,
          user_id: txData.user_id || 1,
          description: txData.description || 'Операция',
          note: txData.note || '',
          occurred_at: txData.occurred_at || new Date().toISOString(),
          status: txData.status || 'ok',
          source: txData.source || 'dashboard',
          raw_text: txData.raw_text ?? null,
          telegram_chat_id: txData.telegram_chat_id ?? null,
          telegram_message_id: txData.telegram_message_id ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return { ...prev, transactions: [newTx, ...prev.transactions] };
      }
    });
    showToast('Операция успешно сохранена');
  };

  const handleDeleteTransaction = (id: number) => {
    updateStore((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
    showToast('Операция удалена. Баланс счёта пересчитан.');
  };

  const handleBulkDelete = (ids: number[]) => {
    updateStore((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => !ids.includes(t.id)),
    }));
    showToast(`Удалено операций: ${ids.length}`);
  };

  const handleBulkMarkOk = (ids: number[]) => {
    updateStore((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        ids.includes(t.id) ? { ...t, status: 'ok' as const, updated_at: new Date().toISOString() } : t
      ),
    }));
    showToast(`Операции (${ids.length} шт) подтверждены`);
  };

  // --- Transfers Handlers ---
  const handleSaveTransfer = (transferData: Omit<Transfer, 'id'>) => {
    updateStore((prev) => {
      const newId = prev.transfers.length > 0 ? Math.max(...prev.transfers.map((t) => t.id)) + 1 : 1;
      const newTr: Transfer = {
        id: newId,
        ...transferData,
      };
      return { ...prev, transfers: [newTr, ...prev.transfers] };
    });
    showToast('Перевод между счетами выполнен');
  };

  const handleDeleteTransfer = (id: number) => {
    updateStore((prev) => ({
      ...prev,
      transfers: prev.transfers.filter((t) => t.id !== id),
    }));
    showToast('Перевод удалён');
  };

  // --- Revision / Adjustment Handler ---
  const handleSaveAdjustment = (adjData: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
    updateStore((prev) => {
      const newId = prev.transactions.length > 0 ? Math.max(...prev.transactions.map((t) => t.id)) + 1 : 1;
      const newTx: Transaction = {
        id: newId,
        ...adjData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return { ...prev, transactions: [newTx, ...prev.transactions] };
    });
    showToast('Сверка баланса зафиксирована корректирующей проводкой');
  };

  // --- Goals Handlers ---
  const handleSaveGoalContribution = (contribData: Omit<GoalContribution, 'id' | 'created_at'>) => {
    updateStore((prev) => {
      const newId = prev.goal_contributions.length > 0 ? Math.max(...prev.goal_contributions.map((c) => c.id)) + 1 : 1;
      const newContrib: GoalContribution = {
        id: newId,
        ...contribData,
        created_at: new Date().toISOString(),
      };
      return { ...prev, goal_contributions: [newContrib, ...prev.goal_contributions] };
    });
    showToast(contribData.amount >= 0 ? 'Взнос в цель зафиксирован' : 'Снятие с цели зафиксировано');
  };

  const handleSaveGoal = (goalData: Partial<Goal>) => {
    updateStore((prev) => {
      if (goalData.id) {
        return {
          ...prev,
          goals: prev.goals.map((g) => (g.id === goalData.id ? ({ ...g, ...goalData } as Goal) : g)),
        };
      } else {
        const newId = prev.goals.length > 0 ? Math.max(...prev.goals.map((g) => g.id)) + 1 : 1;
        const newGoal: Goal = {
          id: newId,
          name: goalData.name || 'Новая цель',
          target_amount: goalData.target_amount || 10000,
          currency: goalData.currency || 'UAH',
          is_active: true,
          created_at: new Date().toISOString(),
        };
        return { ...prev, goals: [...prev.goals, newGoal] };
      }
    });
    showToast('Цель сохранена');
  };

  const handleDeleteGoal = (id: number) => {
    updateStore((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
      goal_contributions: prev.goal_contributions.filter((c) => c.goal_id !== id),
    }));
    showToast('Цель удалена');
  };

  const handleDeleteContribution = (id: number) => {
    updateStore((prev) => ({
      ...prev,
      goal_contributions: prev.goal_contributions.filter((c) => c.id !== id),
    }));
    showToast('Запись о взносе удалена');
  };

  // --- Recurring Handlers ---
  const handleConfirmRecurringPayment = (rec: RecurringPayment) => {
    const isIncome = rec.type === 'income';
    const newTxId = store.transactions.length > 0 ? Math.max(...store.transactions.map((t) => t.id)) + 1 : 1;
    const tx: Transaction = {
      id: newTxId,
      type: isIncome ? 'income' : 'expense',
      amount: rec.amount,
      currency: rec.currency,
      account_id: rec.account_id || store.accounts[0]?.id || 1,
      category_id: rec.category_id || null,
      user_id: selectedUserId !== 'all' ? selectedUserId : 1,
      description: isIncome ? `Регулярный доход: ${rec.name}` : `Регулярный платёж: ${rec.name}`,
      note: isIncome ? `Поступление за ${rec.next_due}` : `Оплата за ${rec.next_due}`,
      occurred_at: new Date().toISOString(),
      status: 'ok',
      source: 'dashboard',
      raw_text: null,
      telegram_chat_id: null,
      telegram_message_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 2. Shift next_due date by 1 month
    const curDueDate = new Date(rec.next_due);
    const nextDueDate = new Date(curDueDate.getFullYear(), curDueDate.getMonth() + 1, rec.day_of_month);
    const updatedNextDue = nextDueDate.toISOString().slice(0, 10);

    updateStore((prev) => ({
      ...prev,
      transactions: [tx, ...prev.transactions],
      recurring_payments: prev.recurring_payments.map((r) =>
        r.id === rec.id ? { ...r, next_due: updatedNextDue } : r
      ),
    }));

    showToast(isIncome ? `Доход «${rec.name}» подтвержден и зачислен` : `Платёж «${rec.name}» подтверждён и сдвинут на следующий месяц`);
  };

  const handleSaveRecurring = (recData: Partial<RecurringPayment>) => {
    updateStore((prev) => {
      if (recData.id) {
        return {
          ...prev,
          recurring_payments: prev.recurring_payments.map((r) =>
            r.id === recData.id ? ({ ...r, ...recData } as RecurringPayment) : r
          ),
        };
      } else {
        const newId = prev.recurring_payments.length > 0 ? Math.max(...prev.recurring_payments.map((r) => r.id)) + 1 : 1;
        const newRec: RecurringPayment = {
          id: newId,
          name: recData.name || 'Платёж',
          amount: recData.amount || 0,
          currency: recData.currency || 'UAH',
          account_id: recData.account_id ?? null,
          category_id: recData.category_id ?? null,
          day_of_month: recData.day_of_month || 15,
          auto_confirm: recData.auto_confirm || false,
          next_due: recData.next_due || new Date().toISOString().slice(0, 10),
          is_active: true,
          type: recData.type || 'expense',
        };
        return { ...prev, recurring_payments: [...prev.recurring_payments, newRec] };
      }
    });
    showToast(recData.type === 'income' ? 'Регулярный доход сохранён' : 'Регулярный платёж сохранён');
  };

  const handleDeleteRecurring = (id: number) => {
    updateStore((prev) => ({
      ...prev,
      recurring_payments: prev.recurring_payments.filter((r) => r.id !== id),
    }));
    showToast('Регулярный платёж удалён');
  };

  // --- Accounts Handlers ---
  const handleSaveAccount = (accData: Partial<Account>) => {
    updateStore((prev) => {
      if (accData.id) {
        return {
          ...prev,
          accounts: prev.accounts.map((a) => (a.id === accData.id ? ({ ...a, ...accData } as Account) : a)),
        };
      } else {
        const newId = prev.accounts.length > 0 ? Math.max(...prev.accounts.map((a) => a.id)) + 1 : 1;
        const newAcc: Account = {
          id: newId,
          name: accData.name || 'Новый счёт',
          kind: accData.kind || 'card',
          currency: accData.currency || 'UAH',
          initial_balance: accData.initial_balance || 0,
          is_active: true,
          sort_order: prev.accounts.length + 1,
        };
        return { ...prev, accounts: [...prev.accounts, newAcc] };
      }
    });
    showToast('Счёт сохранён');
  };

  const handleDeleteAccount = (id: number) => {
    updateStore((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
    }));
    showToast('Счёт удалён');
  };

  // --- Categories Handlers ---
  const handleSaveCategory = (catData: Partial<Category>) => {
    updateStore((prev) => {
      if (catData.id) {
        return {
          ...prev,
          categories: prev.categories.map((c) => (c.id === catData.id ? ({ ...c, ...catData } as Category) : c)),
        };
      } else {
        const newId = prev.categories.length > 0 ? Math.max(...prev.categories.map((c) => c.id)) + 1 : 1;
        const newCat: Category = {
          id: newId,
          name: catData.name || 'Категория',
          group_id: catData.group_id || 1,
          type: catData.type || 'expense',
          is_active: true,
        };
        return { ...prev, categories: [...prev.categories, newCat] };
      }
    });
    showToast('Категория сохранена');
  };

  const handleDeleteCategory = (id: number) => {
    updateStore((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
    }));
    showToast('Категория удалена');
  };

  const handleSaveGroup = (grpData: Partial<CategoryGroup>) => {
    updateStore((prev) => {
      if (grpData.id) {
        return {
          ...prev,
          category_groups: prev.category_groups.map((g) => (g.id === grpData.id ? ({ ...g, ...grpData } as CategoryGroup) : g)),
        };
      } else {
        const newId = prev.category_groups.length > 0 ? Math.max(...prev.category_groups.map((g) => g.id)) + 1 : 1;
        return {
          ...prev,
          category_groups: [...prev.category_groups, { id: newId, name: grpData.name || 'Группа', sort_order: prev.category_groups.length + 1 }],
        };
      }
    });
  };

  // --- Settings Handlers ---
  const handleUpdateSettings = (newSettings: AppSettings) => {
    updateStore((prev) => ({ ...prev, settings: newSettings }));
    showToast('Настройки обновлены');
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
      const parsed = JSON.parse(jsonContent);
      if (parsed.accounts && parsed.transactions && parsed.settings) {
        setStore(parsed);
        saveStore(parsed);
        showToast('База данных успешно восстановлена из бэкапа');
      } else {
        alert('Некорректная структура файла бэкапа.');
      }
    } catch (e) {
      alert('Ошибка при чтении JSON файла бэкапа.');
    }
  };

  const handleClearTestData = () => {
    const updated = clearTestDataOnly(store);
    setStore(updated);
    showToast('Тестовые транзакции очищены. Счета и настройки сохранены.');
  };

  const handleResetDefaults = () => {
    const fresh = resetToDefaults();
    setStore(fresh);
    showToast('База сброшена к демо-данным');
  };

  const handleUpdateNextIncomeDate = (newDate: string) => {
    updateStore((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        next_income_date: newDate,
      },
    }));
    showToast('Дата следующего дохода обновлена');
  };

  const needsReviewCount = store.transactions.filter((tx) => tx.status === 'needs_review').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
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
        defaultUserId={selectedUserId !== 'all' ? selectedUserId : 1}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSave={handleSaveTransfer}
        accounts={store.accounts}
        users={store.users}
        usdRate={store.settings.usd_rate}
        defaultUserId={selectedUserId !== 'all' ? selectedUserId : 1}
      />

      {revisionAccount && (
        <RevisionModal
          isOpen={Boolean(revisionAccount)}
          onClose={() => setRevisionAccount(null)}
          account={revisionAccount}
          currentBalance={calculateAccountBalance(revisionAccount, store.transactions, store.transfers)}
          users={store.users}
          defaultUserId={selectedUserId !== 'all' ? selectedUserId : 1}
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
          defaultUserId={selectedUserId !== 'all' ? selectedUserId : 1}
          onSave={handleSaveGoalContribution}
        />
      )}

      <QuickBotInputModal
        isOpen={isQuickBotModalOpen}
        onClose={() => setIsQuickBotModalOpen(false)}
        accounts={store.accounts}
        categories={store.categories}
        users={store.users}
        defaultUserId={selectedUserId !== 'all' ? selectedUserId : 1}
        lastUsedAccountId={store.transactions[0]?.account_id}
        onSaveTransaction={handleSaveTransaction}
        onPartnerNotification={(txt) => showToast(txt)}
        confirmEnabled={store.settings.confirm_enabled}
      />
    </div>
  );
}
