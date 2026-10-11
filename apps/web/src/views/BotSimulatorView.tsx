import React, { useState } from 'react';
import {
  Send,
  Mic,
  Bot,
  User,
  Check,
  X,
  Edit3,
  Clock,
  Sparkles,
  ArrowRight,
  Shield,
  HelpCircle,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { Account, AppStore, Category, Transaction } from '../types';
import { parseFinancialInput, ParseResult } from '../services/parser';
import {
  calculateAccountBalance,
  calculateMonthComparison,
  calculateNetWorth,
  calculateSafeToSpend,
  formatMoney,
} from '../services/calculations';

interface BotSimulatorViewProps {
  store: AppStore;
  onSaveTransaction: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => void;
  onPartnerNotification: (text: string) => void;
  onExportBackup: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  userName?: string;
  text?: string;
  timestamp: string;
  preview?: {
    parsed: ParseResult;
    accountId: number;
    categoryId?: number;
    amount: number;
    description: string;
  };
  confirmed?: boolean;
}

export const BotSimulatorView: React.FC<BotSimulatorViewProps> = ({
  store,
  onSaveTransaction,
  onPartnerNotification,
  onExportBackup,
}) => {
  const [activeUserId, setActiveUserId] = useState<number>(store.users[0]?.id || 1);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: '👋 Привет! Я бот OoverFinancee. Напиши мне любую трату или доход (например: «кофе 150 мак», «такси 220 болт», «зп 48000»), либо воспользуйся командами /today, /balance, /stats, /backup.',
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const activeUser = store.users.find((u) => u.id === activeUserId);
  const partnerUser = store.users.find((u) => u.id !== activeUserId);

  const handleSendMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;
    const cleanText = textToSend.trim();
    const timeStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    // 1. Add user message
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      userName: activeUser?.name,
      text: cleanText,
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // 2. Handle Bot Commands
    if (cleanText.startsWith('/')) {
      handleBotCommand(cleanText, timeStr);
      return;
    }

    // 3. Natural Language Financial Input
    const parsed = parseFinancialInput(cleanText, store.categories, store.accounts);

    const botPreviewMsg: ChatMessage = {
      id: String(Date.now() + 1),
      sender: 'bot',
      timestamp: timeStr,
      preview: {
        parsed,
        accountId: parsed.accountId || store.accounts[0]?.id || 1,
        categoryId: parsed.categoryId,
        amount: parsed.amount,
        description: parsed.description,
      },
    };

    setMessages((prev) => [...prev, botPreviewMsg]);
  };

  const handleBotCommand = (cmd: string, timeStr: string) => {
    const lower = cmd.toLowerCase().trim();

    if (lower === '/today') {
      const safe = calculateSafeToSpend(
        store.accounts,
        store.transactions,
        store.transfers,
        store.goal_contributions,
        store.recurring_payments,
        store.settings
      );
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayTxs = store.transactions.filter(
        (tx) => tx.type === 'expense' && tx.occurred_at.slice(0, 10) === todayStr
      );

      let text = `📊 Сводка на сегодня:\n\n` +
        `• Потрачено сегодня: ${formatMoney(safe.spentToday)}\n` +
        `• Свободно на день (лимит): ${formatMoney(safe.safePerDay)}\n` +
        `• Остаток дневного лимита: ${formatMoney(safe.remainingLimit)}\n` +
        `• Дней до дохода: ${safe.daysLeft}\n\n`;

      if (todayTxs.length > 0) {
        text += `Операции за день:\n` +
          todayTxs.map((t) => `— ${t.description}: ${formatMoney(t.amount, t.currency)}`).join('\n');
      } else {
        text += `Трат за сегодня ещё не было.`;
      }

      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), sender: 'bot', text, timestamp: timeStr },
      ]);
    } else if (lower === '/balance') {
      const netWorth = calculateNetWorth(
        store.accounts,
        store.transactions,
        store.transfers,
        store.settings.usd_rate
      );
      let text = `💳 Баланс по всем счетам:\n\n`;
      for (const acc of store.accounts.filter((a) => a.is_active)) {
        const bal = calculateAccountBalance(acc, store.transactions, store.transfers);
        text += `• ${acc.name}: ${formatMoney(bal, acc.currency)}\n`;
      }
      text += `\n💰 Общий Net Worth: ${formatMoney(netWorth.netWorthUah, 'UAH')} (курс USD: ${store.settings.usd_rate} ₴)`;

      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), sender: 'bot', text, timestamp: timeStr },
      ]);
    } else if (lower === '/stats') {
      const stats = calculateMonthComparison(store.transactions, store.settings.usd_rate);
      const text = `📈 Статистика за текущий месяц:\n\n` +
        `• Расходы: ${formatMoney(stats.curExpense)} (прошлый: ${formatMoney(stats.prevExpense)}, Δ ${stats.expenseDelta > 0 ? '+' : ''}${formatMoney(stats.expenseDelta)})\n` +
        `• Доходы: ${formatMoney(stats.curIncome)} (прошлый: ${formatMoney(stats.prevIncome)}, Δ ${stats.incomeDelta >= 0 ? '+' : ''}${formatMoney(stats.incomeDelta)})\n` +
        `• Баланс месяца: ${formatMoney(stats.curIncome - stats.curExpense)}`;

      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), sender: 'bot', text, timestamp: timeStr },
      ]);
    } else if (lower === '/backup') {
      onExportBackup();
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'bot',
          text: `📦 Резервная копия базы данных сформирована и сохранена в файл JSON.`,
          timestamp: timeStr,
        },
      ]);
    } else {
      // /help
      const text = `ℹ️ Доступные команды бота:\n\n` +
        `• /today — траты сегодня и остаток Safe-to-spend лимита\n` +
        `• /balance — остатки на счетах и Net Worth\n` +
        `• /stats — итоги месяца и сравнение с прошлым\n` +
        `• /backup — выгрузка резервной копии данных\n\n` +
        `Для записи операции просто отправьте текст, например:\n` +
        `«кофе 150 мак», «такси 240 болт», «продукты 1300 сильпо», «зп 48000».`;

      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), sender: 'bot', text, timestamp: timeStr },
      ]);
    }
  };

  const handleConfirmBotPreview = (msgId: string, preview: NonNullable<ChatMessage['preview']>) => {
    const acc = store.accounts.find((a) => a.id === preview.accountId);

    onSaveTransaction({
      type: preview.parsed.type,
      amount: preview.amount,
      currency: preview.parsed.currency,
      account_id: preview.accountId,
      category_id: preview.categoryId || null,
      user_id: activeUserId,
      description: preview.description,
      note: preview.parsed.rawText,
      occurred_at: new Date().toISOString(),
      status: preview.parsed.status,
      source: 'bot',
      raw_text: preview.parsed.rawText,
      telegram_chat_id: null,
      telegram_message_id: null,
    });

    // Mark preview confirmed
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              confirmed: true,
              text: `✅ Записано: ${preview.description} — ${formatMoney(preview.amount, preview.parsed.currency)} на счёт «${acc?.name}».`,
              preview: undefined,
            }
          : m
      )
    );

    // Silent partner notification
    if (partnerUser && partnerUser.notify_partner) {
      const formattedAmt = formatMoney(preview.amount, preview.parsed.currency);
      const actionName = preview.parsed.type === 'income' ? 'получил(а)' : 'потратил(а)';
      onPartnerNotification(`Уведомление партнёру: ${activeUser?.name} ${actionName} ${formattedAmt} («${preview.description}»)`);
    }
  };

  const handleCancelBotPreview = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              text: `❌ Запись отменена.`,
              preview: undefined,
            }
          : m
      )
    );
  };

  const handleVoiceToggle = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const sample = 'кофе 160 мак с круассаном';
      handleSendMessage(sample);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSendMessage(transcript);
      };

      if (!isListening) {
        recognition.start();
      } else {
        recognition.stop();
      }
    } catch (e) {
      setIsListening(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Bot Chat Header */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>OoverFinancee Bot</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                active
              </span>
            </h2>
            <div className="text-[11px] text-slate-400">
              Эмулятор мобильного шлюза Telegram по спецификации ARCHITECTURE.md
            </div>
          </div>
        </div>

        {/* Current User Simulator Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:inline">В чате:</span>
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {store.users.map((u) => (
              <button
                key={u.id}
                onClick={() => setActiveUserId(u.id)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeUserId === u.id
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {u.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Messages Feed */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 min-h-[420px] max-h-[560px] overflow-y-auto space-y-3 flex flex-col justify-between">
        <div className="space-y-3">
          {messages.map((msg) => {
            if (msg.sender === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[80%] bg-emerald-700/30 border border-emerald-500/30 rounded-2xl rounded-tr-xs px-4 py-2.5 text-xs text-white">
                    <div className="text-[10px] text-emerald-300 font-medium mb-0.5">{msg.userName}</div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <div className="text-[10px] text-emerald-400/80 font-mono text-right mt-1">
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              );
            }

            // Bot message
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[85%] bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-slate-200 space-y-2">
                  {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}

                  {/* Inline keyboard preview according to ARCHITECTURE.md Section 4.1 */}
                  {msg.preview && (
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2.5 mt-1">
                      <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-slate-800 pb-1.5">
                        <span>Распознано:</span>
                        <span className="font-mono text-emerald-400">
                          {formatMoney(msg.preview.amount, msg.preview.parsed.currency)}
                        </span>
                      </div>

                      <div className="space-y-1 text-slate-400 text-[11px]">
                        <div>Тип: <strong className="text-white">{msg.preview.parsed.type === 'income' ? 'Доход' : 'Расход'}</strong></div>
                        <div>Описание: <strong className="text-white">{msg.preview.description}</strong></div>
                        <div>Счёт: <strong className="text-white">{store.accounts.find((a) => a.id === msg.preview?.accountId)?.name}</strong></div>
                        <div>Категория: <strong className="text-white">{store.categories.find((c) => c.id === msg.preview?.categoryId)?.name || 'Прочее'}</strong></div>
                      </div>

                      {/* Inline buttons: [Изменить] [Отмена] [Сохранить ✅] */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handleCancelBotPreview(msg.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={() => handleConfirmBotPreview(msg.id, msg.preview!)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Сохранить ✅</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 font-mono text-right">{msg.timestamp}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Command Buttons */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap gap-1.5">
          <button
            onClick={() => handleSendMessage('/today')}
            className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800"
          >
            /today
          </button>
          <button
            onClick={() => handleSendMessage('/balance')}
            className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800"
          >
            /balance
          </button>
          <button
            onClick={() => handleSendMessage('/stats')}
            className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800"
          >
            /stats
          </button>
          <button
            onClick={() => handleSendMessage('/backup')}
            className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800"
          >
            /backup
          </button>
          <button
            onClick={() => handleSendMessage('/help')}
            className="px-2.5 py-1 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800"
          >
            /help
          </button>
        </div>
      </div>

      {/* Input box */}
      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl relative flex items-center gap-2">
        <input
          type="text"
          placeholder="Напишите боту: «кофе 150 мак» или /today..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage(inputText);
          }}
          className="flex-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
        />

        <button
          onClick={handleVoiceToggle}
          title="Голосовое сообщение Whisper"
          className={`p-2 rounded-lg transition-colors ${
            isListening
              ? 'bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/40'
              : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
          }`}
        >
          <Mic className="w-4 h-4" />
        </button>

        <button
          onClick={() => handleSendMessage(inputText)}
          disabled={!inputText.trim()}
          className="p-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 transition-colors disabled:opacity-40 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
