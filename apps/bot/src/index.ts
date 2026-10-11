import { Bot, Context, GrammyError } from 'grammy';
import { loadConfig } from './config';

/**
 * Точка входа Telegram-бота OoverrFinancee (ROADMAP 1.7).
 *
 * Пока — минимальный каркас: загрузка и валидация .env, запуск бота,
 * проверка доступа по белому списку ID и команда /start.
 * Основной сценарий ввода трат (/balance, /stats, Gemini-парсер) — следующие шаги.
 */

const config = loadConfig();
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

bot.command('start', async (ctx: Context) => {
  await ctx.reply(
    'Привет! Я финансовый трекер OoverrFinancee.\n\n' +
      'Пока умею немного — это только начало. Скоро здесь будут быстрый ввод трат, ' +
      'балансы и статистика.'
  );
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

bot.start({
  onStart: (info) => {
    console.log(`✅ Бот @${info.username} работает (long polling). Остановить: Ctrl+C`);
  },
});
