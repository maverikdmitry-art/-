import React, { useState } from 'react';
import {
  Settings,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Check,
  AlertTriangle,
  DollarSign,
  Calendar,
  Bell,
  Globe,
} from 'lucide-react';
import { AppSettings, AppStore } from '../types';

interface SettingsViewProps {
  store: AppStore;
  onUpdateSettings: (settings: AppSettings) => void;
  onExportCsv: () => void;
  onExportBackup: () => void;
  onImportBackup: (jsonContent: string) => void;
  onClearTestData: () => void;
  onResetDefaults: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  store,
  onUpdateSettings,
  onExportCsv,
  onExportBackup,
  onImportBackup,
  onClearTestData,
  onResetDefaults,
}) => {
  const [usdRate, setUsdRate] = useState<string>(String(store.settings.usd_rate));
  const [nextIncomeDate, setNextIncomeDate] = useState<string>(store.settings.next_income_date);
  const [overspendPct, setOverspendPct] = useState<string>(String(store.settings.overspend_alert_pct));
  const [confirmEnabled, setConfirmEnabled] = useState<boolean>(store.settings.confirm_enabled);
  const [timezone, setTimezone] = useState<string>(store.settings.timezone);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(usdRate) || 41.5;
    const pct = parseInt(overspendPct, 10) || 30;

    onUpdateSettings({
      usd_rate: rate,
      next_income_date: nextIncomeDate,
      overspend_alert_pct: pct,
      confirm_enabled: confirmEnabled,
      timezone,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportBackup(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>Настройки системы и управление данными</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Глобальные константы, резервное копирование и управление архивом OoverFinancee.
          </p>
        </div>

        {savedSuccess && (
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
            <Check className="w-3.5 h-3.5" />
            Сохранено
          </span>
        )}
      </div>

      {/* Global Financial Parameters Form */}
      <form onSubmit={handleSaveSettings} className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white border-b border-slate-800/80 pb-2">
          Финансовые константы и лимиты
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-slate-500" />
              <span>Курс USD к UAH (ручной ввод по spec)</span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={usdRate}
              onChange={(e) => setUsdRate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Используется для пересчёта Net Worth и валютных операций.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Дата следующего дохода (next_income_date)</span>
            </label>
            <input
              type="date"
              required
              value={nextIncomeDate}
              onChange={(e) => setNextIncomeDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Определяет количество дней для Safe-to-spend: days_left = max(1, next_income_date − today).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-slate-500" />
              <span>Порог предупреждения о перерасходе (%)</span>
            </label>
            <input
              type="number"
              min="5"
              max="95"
              required
              value={overspendPct}
              onChange={(e) => setOverspendPct(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Уведомление при остатке ≤ {overspendPct}% от дневного лимита (по умолчанию 30%).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>Часовой пояс (timezone)</span>
            </label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Для фиксации времени операций в UTC и локального отображения.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="confirm_enabled"
              checked={confirmEnabled}
              onChange={(e) => setConfirmEnabled(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0"
            />
            <label htmlFor="confirm_enabled" className="text-xs text-slate-300">
              Показывать inline-превью [Изменить] [Отмена] [Сохранить ✅] перед записью в боте
            </label>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800/80 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Применить настройки</span>
          </button>
        </div>
      </form>

      {/* Backup & Export Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white border-b border-slate-800/80 pb-2">
          Резервное копирование и экспорт
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={onExportBackup}
            className="p-4 bg-slate-950 hover:bg-slate-850 rounded-xl border border-slate-800 transition-colors text-left flex flex-col justify-between group cursor-pointer"
          >
            <div>
              <Download className="w-5 h-5 text-emerald-400 group-hover:scale-105 transition-transform" />
              <div className="text-xs font-semibold text-white mt-2">Скачать бэкап JSON</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Полный снимок базы: счета, категории, операции, цели.
              </div>
            </div>
            <div className="text-[11px] text-emerald-400 font-medium mt-3">Экспорт базы →</div>
          </button>

          <button
            onClick={onExportCsv}
            className="p-4 bg-slate-950 hover:bg-slate-850 rounded-xl border border-slate-800 transition-colors text-left flex flex-col justify-between group cursor-pointer"
          >
            <div>
              <Download className="w-5 h-5 text-blue-400 group-hover:scale-105 transition-transform" />
              <div className="text-xs font-semibold text-white mt-2">Экспорт в CSV (Excel)</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Таблица всех транзакций с авторами, счетами и датами.
              </div>
            </div>
            <div className="text-[11px] text-blue-400 font-medium mt-3">Скачать CSV →</div>
          </button>

          <label className="p-4 bg-slate-950 hover:bg-slate-850 rounded-xl border border-slate-800 transition-colors text-left flex flex-col justify-between group cursor-pointer">
            <div>
              <Upload className="w-5 h-5 text-purple-400 group-hover:scale-105 transition-transform" />
              <div className="text-xs font-semibold text-white mt-2">Восстановить из файла</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Загрузить сохранённый JSON файл бэкапа.
              </div>
            </div>
            <div className="text-[11px] text-purple-400 font-medium mt-3">Выбрать файл...</div>
            <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
          </label>
        </div>
      </div>

      {/* Danger Zone: Clear test data or reset */}
      <div className="bg-slate-900/90 border border-rose-500/20 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-rose-300 border-b border-rose-500/20 pb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>Очистка данных и сброс</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* DATABASE.md Section 9: «Очистить тестовые данные» */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-white">Очистить тестовые данные</h4>
            <p className="text-[11px] text-slate-400">
              Удаляет только транзакции, переводы и взносы по целям. Счета, категории, пользователи и настройки остаются нетронутыми.
            </p>
            <button
              onClick={() => {
                if (confirm('Очистить тестовые операции? Счета и категории сохранятся.')) {
                  onClearTestData();
                }
              }}
              className="mt-2 px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
            >
              Очистить операции
            </button>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-white">Сброс к исходным данным</h4>
            <p className="text-[11px] text-slate-400">
              Восстанавливает стандартный комплект счетов (Монобанк, Райффайзен, Наличные, USD Сейф), базовые категории и стартовый набор операций.
            </p>
            <button
              onClick={() => {
                if (confirm('Сбросить базу данных к исходному состоянию?')) {
                  onResetDefaults();
                }
              }}
              className="mt-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Сбросить к исходным
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
