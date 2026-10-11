import { Bot, GrammyError } from 'grammy';
import { config } from './config';
import { handleBalance, handleHelp, handleStart } from './handlers';

/**
 * Точка входа Telegram-бота OoverrFinancee (ROADMAP 1.7–1.9).
 *
 * Загрузка и валидация .env, запуск бота, проверка доступа по белому списку ID,
 * команды /start, /help, /balance. Ввод трат и /stats — следующие шаги.
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
      'Команда /balance будет сообщать об отсутствии подключения.'
  );
}

bot.start({
  onStart: (info) => {
    console.log(`✅ Бот @${info.username} работает (long polling). Остановить: Ctrl+C`);
  },
});
