import React, { useState, useEffect } from 'react';
import { X, Mic, Send, Sparkles, Check, Edit3, ArrowRight, Bell, AlertTriangle } from 'lucide-react';
import { Account, Category, Transaction, User } from '../types';
import { parseFinancialInput, ParseResult } from '../services/parser';
import { formatMoney } from '../services/calculations';

interface QuickBotInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  users: User[];
  defaultUserId?: number;
  lastUsedAccountId?: number;
  onSaveTransaction: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => void;
  onPartnerNotification: (text: string) => void;
  confirmEnabled?: boolean;
}

export const QuickBotInputModal: React.FC<QuickBotInputModalProps> = ({
  isOpen,
  onClose,
  accounts,
  categories,
  users,
  defaultUserId = 1,
  lastUsedAccountId,
  onSaveTransaction,
  onPartnerNotification,
  confirmEnabled = true,
}) => {
  const [inputText, setInputText] = useState('');
  const [userId, setUserId] = useState<number>(defaultUserId);
  const [isListening, setIsListening] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Editable parsed fields
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editAccountId, setEditAccountId] = useState<number>(1);
  const [editCategoryId, setEditCategoryId] = useState<number | undefined>(undefined);
  const [editDescription, setEditDescription] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setInputText('');
      setParsed(null);
      setEditMode(false);
      setUserId(defaultUserId);
    }
  }, [isOpen, defaultUserId]);

  const handleParse = (textToParse: string) => {
    if (!textToParse.trim()) return;
    const res = parseFinancialInput(textToParse, categories, accounts, lastUsedAccountId);
    setParsed(res);
    setEditAmount(res.amount);
    setEditAccountId(res.accountId || accounts[0]?.id || 1);
    setEditCategoryId(res.categoryId);
    setEditDescription(res.description);
    setEditMode(false);
  };

  const handleVoiceToggle = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback: cycle a sample voice message
      const samples = [
        'кофе 180 мак с круассаном',
        'продукты 1450 сильпо на выходные',
        'такси 290 болт в аэропорт',
        'зарплата 45000 аванс',
      ];
      const randomSample = samples[Math.floor(Math.random() * samples.length)];
      setInputText(randomSample);
      handleParse(randomSample);
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
        setInputText(transcript);
        handleParse(transcript);
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

  const handleConfirmSave = () => {
    if (!parsed) return;
    const currentAuthor = users.find((u) => u.id === userId);
    const partner = users.find((u) => u.id !== userId);

    const tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'> = {
      type: parsed.type,
      amount: editAmount || parsed.amount,
      currency: parsed.currency,
      account_id: editAccountId,
      category_id: editCategoryId || null,
      user_id: userId,
      description: editDescription || parsed.description,
      note: parsed.rawText,
      occurred_at: new Date().toISOString(),
      status: parsed.status,
      source: 'bot',
      raw_text: parsed.rawText,
      telegram_chat_id: null,
      telegram_message_id: null,
    };

    onSaveTransaction(tx);

    // Silent partner notification if enabled
    if (partner && partner.notify_partner) {
      const formattedAmt = formatMoney(tx.amount, tx.currency);
      const actionName = tx.type === 'income' ? 'получил(а)' : 'потратил(а)';
      onPartnerNotification(`Уведомление партнёру: ${currentAuthor?.name || 'Пользователь'} ${actionName} ${formattedAmt} («${tx.description}»)`);
    }

    onClose();
  };

  if (!isOpen) return null;

  const quickSamples = [
    'кофе 150 мак',
    'продукты 1200 сильпо',
    'такси 240 болт',
    'зп 48000',
    'коммуналка 2100',
    'наличка обед 180',
  ];

  const matchedAccount = accounts.find((a) => a.id === editAccountId);
  const matchedCategory = categories.find((c) => c.id === editCategoryId);
  const currentAuthor = users.find((u) => u.id === userId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Быстрый ввод (Smart Parser)</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Author switch */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Автор записи в боте:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setUserId(u.id)}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    userId === u.id
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>

          {/* Input & voice button */}
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="Например: кофе 150 мак или такси 240..."
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (e.target.value.trim().length > 2) {
                  handleParse(e.target.value);
                } else {
                  setParsed(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && parsed) {
                  handleConfirmSave();
                }
              }}
              className="w-full pl-4 pr-24 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
            />
            <div className="absolute right-2 top-2 flex items-center gap-1">
              <button
                type="button"
                onClick={handleVoiceToggle}
                title="Голосовой ввод (Whisper)"
                className={`p-2 rounded-md transition-colors ${
                  isListening
                    ? 'bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleParse(inputText)}
                disabled={!inputText.trim()}
                className="p-2 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-500 mr-1">Примеры:</span>
            {quickSamples.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => {
                  setInputText(sample);
                  handleParse(sample);
                }}
                className="px-2 py-0.5 text-[11px] font-mono text-slate-400 hover:text-emerald-300 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800/80 transition-colors cursor-pointer"
              >
                {sample}
              </button>
            ))}
          </div>

          {/* Telegram-style Inline Preview as specified in ARCHITECTURE.md */}
          {parsed && (
            <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800/90 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-semibold text-slate-300">
                  Превью распознанной операции
                </span>
                <span
                  className={`text-[11px] font-mono ${
                    parsed.status === 'ok' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {parsed.status === 'ok' ? 'Распознано точно' : 'Требует разбора (needs_review)'}
                </span>
              </div>

              {!editMode ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Тип:</span>
                    <span
                      className={`font-semibold ${
                        parsed.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {parsed.type === 'income' ? 'Доход' : 'Расход'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Сумма:</span>
                    <span className="text-white font-mono font-bold text-sm">
                      {formatMoney(editAmount || parsed.amount, parsed.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Счёт:</span>
                    <span className="text-white">{matchedAccount?.name || 'Не выбран'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Категория:</span>
                    <span className="text-white">{matchedCategory?.name || 'Без категории'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Описание:</span>
                    <span className="text-white">{editDescription || parsed.description}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-1 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Сумма:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Счёт:</label>
                      <select
                        value={editAccountId}
                        onChange={(e) => setEditAccountId(Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Категория:</label>
                      <select
                        value={editCategoryId || ''}
                        onChange={(e) => setEditCategoryId(Number(e.target.value) || undefined)}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                      >
                        <option value="">Без категории</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Описание:</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white"
                    />
                  </div>
                </div>
              )}

              {/* Exact inline keyboard from ARCHITECTURE.md Section 4.1:
                  [Изменить] [Отмена] [Сохранить ✅] */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setEditMode(!editMode)}
                  className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors flex items-center justify-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{editMode ? 'Готово' : 'Изменить'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setParsed(null);
                    setInputText('');
                  }}
                  className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="px-3 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Сохранить ✅</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
