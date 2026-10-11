/**
 * @oover/shared — общий код OoverrFinancee.
 * Импортируется и веб-дашбордом (apps/web), и Telegram-ботом (apps/bot).
 *
 * Структура:
 *   types.ts        — типы данных (совпадают со схемой БД)
 *   money.ts        — деньги без float (decimal.js)
 *   time.ts         — границы суток по Europe/Kyiv
 *   calculations.ts — баланс, Net Worth, Safe-to-spend
 *   parser/         — regex-парсер + каскад Gemini → regex
 *   gemini/         — клиент Gemini, LLM-парсер, распознавание голоса
 *   supabase/       — фабрики клиентов и мапперы строк БД
 */

export * from './types';
export * from './money';
export * from './time';
export * from './calculations';
export * from './parser';
export * from './gemini/client';
export * from './gemini/parse';
export * from './gemini/transcribe';
export * from './supabase/client';
export * from './supabase/mappers';
