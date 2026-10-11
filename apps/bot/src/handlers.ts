import type { Context } from 'grammy';
import { convertToUah, formatMoney, round2, sumMoney } from '@oover/shared';
import type { Account, SupabaseClientAny } from '@oover/shared';
import { fetchAccounts, fetchSettings, getSupabase } from './db';

/**
 * Обработчики команд бота (ROADMAP 1.8–1.9).
 * Балансы и деньги считаются функциями из @oover/shared, а не вручную.
 */

const NO_DB_MESSAGE =
  '⚠️ База данных не подключена. Добавь SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env и перезапусти бота.';

/** /start — приветствие и подсказка по доступным командам. */
export async function handleStart(ctx: Context): Promise<void> {
  const name = ctx.from?.first_name?.trim();
  const greeting = name ? `Привет, ${name}!` : 'Привет!';
  await ctx.reply(
    `${greeting}\n\n` +
      'Я финансовый трекер OoverrFinancee.\n\n' +
      'Доступные команды:\n' +
      '/balance — баланс по счетам и Net Worth\n' +
      '/help — справка по командам\n\n' +
      'Скоро добавим быстрый ввод трат («кофе 150») и статистику.'
  );
}

/** /help — список команд. */
export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(
    'Команды бота:\n\n' +
      '/balance — текущий баланс счетов и Net Worth\n' +
      '/help — эта справка\n' +
      '/start — приветствие'
  );
}

/**
 * /balance — читает представление account_balances и выводит баланс счетов.
 * Если БД не подключена или запрос упал — понятное сообщение вместо ошибки.
 */
export async function handleBalance(ctx: Context): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    await ctx.reply(NO_DB_MESSAGE);
    return;
  }

  try {
    const accounts = await fetchAccounts(supabase);
    const kindById = new Map(accounts.map((a) => [a.id, a.kind]));
    const rows = await fetchAccountBalances(supabase, kindById);

    if (rows.length === 0) {
      await ctx.reply('Пока нет ни одного счёта. Добавь счета в дашборде или через /setup.');
      return;
    }

    const lines = rows.map((row) => {
      const kind = row.kind === 'cash' ? ' (нал.)' : '';
      return `• ${row.account_name}${kind}: ${formatMoney(row.balance, row.currency)}`;
    });

    // Net Worth: переводим все активные счета в UAH по курсу из настроек.
    const settings = await fetchSettings(supabase);
    const netWorth = calcNetWorth(rows, accounts, settings.usd_rate);

    await ctx.reply(
      ['💰 Баланс по счетам:', ...lines, '', `📊 Net Worth: ${formatMoney(netWorth, 'UAH')}`].join(
        '\n'
      )
    );
  } catch (error) {
    await ctx.reply('❌ Не удалось получить баланс. Попробуй позже.');
    console.error('[balance] ошибка:', error instanceof Error ? error.message : error);
  }
}

type BalanceRow = {
  account_id: number;
  account_name: string;
  currency: string;
  balance: number;
  kind: 'card' | 'cash';
};

/** Читает представление account_balances (единый источник балансов, учитывает переводы). */
async function fetchAccountBalances(
  supabase: SupabaseClientAny,
  kindById: Map<number, 'card' | 'cash'>
): Promise<BalanceRow[]> {
  const { data, error } = await supabase
    .from('account_balances')
    .select('account_id, account_name, currency, balance');
  if (error) throw new Error(`account_balances: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const accountId = Number(row.account_id);
    return {
      account_id: accountId,
      account_name: String(row.account_name ?? ''),
      currency: String(row.currency ?? 'UAH'),
      balance: Number(row.balance ?? 0),
      kind: kindById.get(accountId) ?? 'card',
    };
  });
}

/** Сумма балансов активных счетов, переведённая в UAH. Деньги — через функции shared. */
function calcNetWorth(rows: BalanceRow[], accounts: Account[], usdRate: number): number {
  const activeIds = new Set(accounts.filter((a) => a.is_active).map((a) => a.id));
  const uahAmounts = rows
    .filter((row) => activeIds.has(row.account_id))
    .map((row) => convertToUah(row.balance, row.currency as 'UAH' | 'USD', usdRate));
  return round2(sumMoney(uahAmounts));
}

