import { Bot, GrammyError } from 'grammy';
import { config } from './config';
import { handleBalance, handleCancelCommand, handleExpense, handleHelp, handleIncome, handleStart, handleStats, handleToday } from './handlers';
import { handleCancel, handleEdit, handleSave, handleText } from './input';

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
bot.command('income', handleIncome);
bot.command('expense', handleExpense);
bot.command('cancel', handleCancelCommand);
bot.command('today', handleToday);
bot.command('stats', handleStats);

// Ввод трат: любой текст (кроме команд) → разбор → превью с кнопками.
bot.on('message:text', handleText);

// Кнопки подтверждения/отмены под превью операции.
bot.callbackQuery('tx:save', handleSave);
bot.callbackQuery('tx:edit', handleEdit);
bot.callbackQuery('tx:cancel', handleCancel);

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
if (!config.GEMINI_API_KEY) {
  console.warn('[config] GEMINI_API_KEY не задан — разбор трат работает на regex-фоллбэке.');
}

bot.start({
  onStart: (info) => {
    console.log(`✅ Бот @${info.username} работает (long polling). Остановить: Ctrl+C`);
  },
});
