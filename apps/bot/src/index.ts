import { Bot, GrammyError } from 'grammy';
import { config } from './config';
import { handleBalance, handleBackup, handleCancelCommand, handleExpense, handleHelp, handleIncome, handleRecurring, handleStart, handleStats, handleStatsMonth, handleStatsWeek, handleToday, handleUndo } from './handlers';
import { cancelRecurring, handleCancel, handleEdit, handleRecurringSave, handleSave, handleText } from './input';
import { handleNotifyCommand } from './notifications';

/**
 * Точка входа Telegram-бота OoverrFinancee (ROADMAP 1.7–1.8).
 *
 * Загрузка и валидация .env, запуск бота, проверка доступа по белому списку ID,
 * команды /start, /help, /balance и ввод трат текстом («кофе 150») с превью и кнопками.
 */

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// Белый список: чей ID разрешён пользоваться ботом. Остальных молча игнорируем.
const allowedIds = new Set<number>(config.ALLOWED_TELEGRAM_IDS);

bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (userId !== undefined && allowedIds.has(userId)) {
    await next();
    return;
  }
  // Чужой ID — не отвечаем (бот приватный, только для двух человек семьи).
  if (userId !== undefined) {
    console.warn(`[auth] отклонён доступ: telegram_id=${userId}`);
  }
});

bot.command('start', handleStart);
bot.command('help', handleHelp);
bot.command('balance', handleBalance);
bot.command('backup', handleBackup);
bot.command('recurring', handleRecurring);
bot.command('income', handleIncome);
bot.command('expense', handleExpense);
bot.command('cancel', handleCancelCommand);
bot.command('today', handleToday);
bot.command('undo', handleUndo);
bot.command('stats', handleStats);
bot.command('notify', handleNotifyCommand);

// Постоянная клавиатура под чатом: кнопки → команды.
bot.on('message:text', async (ctx, next) => {
  const text = ctx.message?.text;
  if (!text) return await next();

  const buttonToHandler: Record<string, () => Promise<void>> = {
    '💰 Баланс': () => handleBalance(ctx),
    '📅 Сегодня': () => handleToday(ctx),
    '📊 Статистика': () => handleStats(ctx),
    '💸 Трата': () => handleExpense(ctx),
    '💰 Доход': () => handleIncome(ctx),
    '❌ Отмена': () => handleCancelCommand(ctx),
  };

  const handler = buttonToHandler[text];
  if (handler) {
    await handler();
    return;
  }
  await next();
});

// Ввод трат: любой текст (кроме команд) → разбор → превью с кнопками.
bot.on('message:text', handleText);

// Кнопки выбора периода статистики.
bot.callbackQuery('stats:month', handleStatsMonth);
bot.callbackQuery('stats:week', handleStatsWeek);

// Кнопки подтверждения/отмены под превью операции.
bot.callbackQuery('tx:save', handleSave);
bot.callbackQuery('tx:edit', handleEdit);
bot.callbackQuery('tx:cancel', handleCancel);

// Кнопки подтверждения/отмены для регулярного платежа.
bot.callbackQuery('rec:save', handleRecurringSave);
bot.callbackQuery('rec:cancel', async (ctx) => {
  const id = ctx.from?.id;
  if (id !== undefined) cancelRecurring(id);
  await ctx.editMessageText('✖️ Отменено.');
  await ctx.answerCallbackQuery();
});

// Ловим любые ошибки обработчиков, чтобы один сбой не ронял бота.
bot.catch((err) => {
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error('[grammy] ошибка запроса к Telegram API:', e.description);
  } else {
    console.error('[bot] непредвиденная ошибка:', e);
  }
});

console.log('Бот OoverrFinancee запускается…');
console.log(`Разрешённые Telegram ID: ${config.ALLOWED_TELEGRAM_IDS.join(', ')}`);
if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[config] Supabase не настроен (нет SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY в .env). ' +
      'Команда /balance и ввод трат будут сообщать об отсутствии подключения.'
  );
}

// Регистрируем команды в BotFather (кнопка "/" в Telegram).
await bot.api.setMyCommands([
  { command: 'start', description: 'Приветствие и команды' },
  { command: 'help', description: 'Справка' },
  { command: 'balance', description: 'Баланс счетов и Капитал' },
  { command: 'today', description: 'Доходы и расходы за сегодня' },
  { command: 'stats', description: 'Статистика за месяц' },
  { command: 'income', description: 'Внести доход' },
  { command: 'expense', description: 'Внести трату' },
  { command: 'recurring', description: 'Регулярный платёж' },
  { command: 'backup', description: 'Резервная копия' },
  { command: 'undo', description: 'Удалить последнюю операцию' },
  { command: 'cancel', description: 'Отменить ввод' },
  { command: 'notify', description: 'Вкл/выкл уведомления партнёру' },
]);

bot.start({
  onStart: (info) => {
    console.log(`✅ Бот @${info.username} работает (long polling). Остановить: Ctrl+C`);
  },
});
