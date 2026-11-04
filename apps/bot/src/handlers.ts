import type { Context } from 'grammy';
import { InputFile, Keyboard, InlineKeyboard } from 'grammy';
import { calculateAccountBalance, convertToUah, formatMoney, round2, sumMoney, todayYmd, toYmd, toDecimal } from '@oover/shared';
import { cancelPending, startRecurringDialog } from './input';
import { deleteLastTransaction, fetchAccounts, fetchCategories, fetchRecurring, fetchSettings, fetchTransactions, fetchTransfers, fetchUserByTelegramId, getSupabase } from './db';

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
  const keyboard = new Keyboard()
    .text('💰 Баланс').text('📅 Сегодня').row()
    .text('💸 Трата').text('💰 Доход').row()
    .text('📊 Статистика').text('❌ Отмена');
  await ctx.reply(
    `${greeting}\n\n` +
      'Я финансовый трекер OoverrFinancee.\n\n' +
      'Под чатом уже есть кнопки — нажимай, чтобы быстро посмотреть баланс, сегодня или статистику.\n\n' +
      'Чтобы записать трату или доход, просто напиши текстом:\n' +
      '• «кофе 150» — расход 150 ₴\n' +
      '• «зп 20000» — доход\n' +
      '• «15$ такси» — расход в долларах\n\n' +
      'Я покажу разбор и спрошу подтверждение перед сохранением.',
    { reply_markup: keyboard }
  );
}

/** /help — список команд. */
export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(
    '📋 Все команды:\n\n' +
      '/start — приветствие\n' +
      '/help — эта справка\n' +
      '/balance — баланс по счетам и Капитал\n' +
      '/today — доходы и расходы за сегодня\n' +
      '/stats — статистика за месяц или неделю\n' +
      '/income — внести доход\n' +
      '/expense — внести трату\n' +
      '/recurring — регулярный платёж\n' +
      '/backup — резервная копия данных\n' +
      '/undo — удалить последнюю операцию\n' +
      '/cancel — отменить текущий ввод\n\n' +
      '💬 Ввод текстом:\n' +
      '• «кофе 150» — расход 150 ₴\n' +
      '• «такси 340 болт» — с категорией Транспорт\n' +
      '• «зп 20000» — доход\n' +
      '• «15$ такси» — расход в долларах\n\n' +
      'Под чатом есть кнопки для быстрого доступа. Под превью операции нажимай «Сохранить», «Изменить» или «Отмена».'
  );
}

/** /today — показать доходы и расходы за сегодня (по Europe/Kyiv). */
export async function handleToday(ctx: Context): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    await ctx.reply(NO_DB_MESSAGE);
    return;
  }
  try {
    const [accounts, transactions, settings] = await Promise.all([
      fetchAccounts(supabase),
      fetchTransactions(supabase),
      fetchSettings(supabase),
    ]);
    const today = todayYmd();
    const todayTxs = transactions.filter((tx) => toYmd(tx.occurred_at) === today);
    const income = todayTxs.filter((tx) => tx.type === 'income');
    const expense = todayTxs.filter((tx) => tx.type === 'expense');
    const incomeTotalUah = round2(sumMoney(income.map((tx) => convertToUah(tx.amount, tx.currency, settings.usd_rate))));
    const expenseTotalUah = round2(sumMoney(expense.map((tx) => convertToUah(tx.amount, tx.currency, settings.usd_rate))));

    const lines: string[] = ['📅 Сегодня:'];
    if (income.length > 0) {
      lines.push(`\n💰 Доходы: ${formatMoney(incomeTotalUah, 'UAH')}`);
      for (const tx of income) {
        const acc = accounts.find((a) => a.id === tx.account_id)?.name ?? '—';
        lines.push(`• +${formatMoney(tx.amount, tx.currency)} — ${tx.description ?? 'без описания'} (${acc})`);
      }
    }
    if (expense.length > 0) {
      lines.push(`\n💸 Расходы: ${formatMoney(expenseTotalUah, 'UAH')}`);
      for (const tx of expense) {
        const acc = accounts.find((a) => a.id === tx.account_id)?.name ?? '—';
        lines.push(`• -${formatMoney(tx.amount, tx.currency)} — ${tx.description ?? 'без описания'} (${acc})`);
      }
    }
    if (income.length === 0 && expense.length === 0) {
      lines.push('Операций за сегодня нет.');
    }

    await ctx.reply(lines.join('\n'));
  } catch (error) {
    await ctx.reply('❌ Не удалось получить операции за сегодня. Попробуй позже.');
    console.error('[today] ошибка:', error instanceof Error ? error.message : error);
  }
}


export async function handleStats(ctx: Context): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text('📅 Месяц', 'stats:month')
    .text('📅 Неделя', 'stats:week');
  await ctx.reply('📈 Выберите период статистики:', { reply_markup: keyboard });
}

/** Красивая строка разницы с прошлым периодом. */
function formatDelta(label: string, cur: number, prev: number): string {
  const delta = round2(toDecimal(cur).minus(prev));
  if (delta > 0) return `▲ ${label} на ${formatMoney(delta, 'UAH')} больше`;
  if (delta < 0) return `▼ ${label} на ${formatMoney(Math.abs(delta), 'UAH')} меньше`;
  return `— ${label} без изменений`;
}

/** /stats месяц — доходы/расходы за месяц с сравнением прошлого месяца. */
export async function handleStatsMonth(ctx: Context): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    await ctx.reply(NO_DB_MESSAGE);
    return;
  }
  try {
    const [transactions, settings] = await Promise.all([
      fetchTransactions(supabase),
      fetchSettings(supabase),
    ]);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const prevMonth = new Date(curYear, curMonth - 1, 1);

    let curExpense = 0;
    let curIncome = 0;
    let prevExpense = 0;
    let prevIncome = 0;

    for (const tx of transactions) {
      if (tx.type === 'adjustment') continue;
      const date = new Date(tx.occurred_at);
      const amount = convertToUah(tx.amount, tx.currency, settings.usd_rate);
      if (date.getFullYear() === curYear && date.getMonth() === curMonth) {
        if (tx.type === 'expense') curExpense += amount;
        if (tx.type === 'income') curIncome += amount;
      } else if (date.getFullYear() === prevMonth.getFullYear() && date.getMonth() === prevMonth.getMonth()) {
        if (tx.type === 'expense') prevExpense += amount;
        if (tx.type === 'income') prevIncome += amount;
      }
    }

    curExpense = round2(curExpense);
    curIncome = round2(curIncome);
    prevExpense = round2(prevExpense);
    prevIncome = round2(prevIncome);

    await ctx.reply(
      [
        '📈 Статистика за месяц:',
        `💸 Потрачено: ${formatMoney(curExpense, 'UAH')}`,
        `💰 Доходов: ${formatMoney(curIncome, 'UAH')}`,
        `📊 Баланс месяца: ${formatMoney(round2(toDecimal(curIncome).minus(curExpense)), 'UAH')}`,
        '',
        'В сравнении с прошлым месяцем:',
        formatDelta('Потрачено', curExpense, prevExpense),
        formatDelta('Доходов', curIncome, prevIncome),
      ].join('\n')
    );
  } catch (error) {
    await ctx.reply('❌ Не удалось получить статистику за месяц. Попробуй позже.');
    console.error('[stats:month] ошибка:', error instanceof Error ? error.message : error);
  }
}

/** /stats неделя — доходы/расходы за неделю с сравнением прошлой недели. */
export async function handleStatsWeek(ctx: Context): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    await ctx.reply(NO_DB_MESSAGE);
    return;
  }
  try {
    const [transactions, settings] = await Promise.all([
      fetchTransactions(supabase),
      fetchSettings(supabase),
    ]);
    const now = new Date();
    const dayIndex = (now.getDay() + 6) % 7; // понедельник = 0
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayIndex);
    weekStart.setHours(0, 0, 0, 0);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekStart);
    prevWeekEnd.setDate(weekStart.getDate() - 1);
    prevWeekEnd.setHours(23, 59, 59, 999);

    let curExpense = 0;
    let curIncome = 0;
    let prevExpense = 0;
    let prevIncome = 0;

    for (const tx of transactions) {
      if (tx.type === 'adjustment') continue;
      const date = new Date(tx.occurred_at);
      const amount = convertToUah(tx.amount, tx.currency, settings.usd_rate);
      if (date >= weekStart && date <= now) {
        if (tx.type === 'expense') curExpense += amount;
        if (tx.type === 'income') curIncome += amount;
      } else if (date >= prevWeekStart && date <= prevWeekEnd) {
        if (tx.type === 'expense') prevExpense += amount;
        if (tx.type === 'income') prevIncome += amount;
      }
    }

    curExpense = round2(curExpense);
    curIncome = round2(curIncome);
    prevExpense = round2(prevExpense);
    prevIncome = round2(prevIncome);

    await ctx.reply(
      [
        '📈 Статистика за неделю:',
        `💸 Потрачено: ${formatMoney(curExpense, 'UAH')}`,
        `💰 Доходов: ${formatMoney(curIncome, 'UAH')}`,
        `📊 Баланс недели: ${formatMoney(round2(toDecimal(curIncome).minus(curExpense)), 'UAH')}`,
        '',
        'В сравнении с прошлой неделей:',
        formatDelta('Потрачено', curExpense, prevExpense),
        formatDelta('Доходов', curIncome, prevIncome),
      ].join('\n')
    );
  } catch (error) {
    await ctx.reply('❌ Не удалось получить статистику за неделю. Попробуй позже.');
    console.error('[stats:week] ошибка:', error instanceof Error ? error.message : error);
  }
}


/** /balance — баланс по счетам и Капитал. */
export async function handleBalance(ctx: Context): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    await ctx.reply(NO_DB_MESSAGE);
    return;
  }

  try {
    const [accounts, transactions, transfers, settings] = await Promise.all([
      fetchAccounts(supabase),
      fetchTransactions(supabase),
      fetchTransfers(supabase),
      fetchSettings(supabase),
    ]);

    const activeAccounts = accounts.filter((a) => a.is_active);
    if (activeAccounts.length === 0) {
      await ctx.reply('Пока нет ни одного активного счёта. Добавь счета в дашборде.');
      return;
    }

    const lines: string[] = ['💰 Баланс по счетам:'];
    let totalUah = 0;
    let hasNonZero = false;

    for (const acc of activeAccounts) {
      const balance = calculateAccountBalance(acc, transactions, transfers);
      if (balance === 0) continue;
      hasNonZero = true;
      lines.push(`• ${acc.name}: ${formatMoney(balance, acc.currency)}`);
      totalUah += convertToUah(balance, acc.currency, settings.usd_rate);
    }

    if (!hasNonZero) {
      await ctx.reply('💰 Баланс по счетам:\nНет счетов с ненулевым балансом.');
      return;
    }

    totalUah = round2(totalUah);
    lines.push('', `📊 Капитал: ${formatMoney(totalUah, 'UAH')}`);

    await ctx.reply(lines.join('\n'));
  } catch (error) {
    await ctx.reply('❌ Не удалось получить баланс. Попробуй позже.');
    console.error('[balance] ошибка:', error instanceof Error ? error.message : error);
  }
}



/** /income — подсказка по вводу дохода. */
export async function handleIncome(ctx: Context): Promise<void> {
  await ctx.reply(
    'Внеси поступление. Напиши, например:\n' +
      '• «зп 20000»\n' +
      '• «фриланс 5000»\n' +
      '• «возврат 300»'
  );
}

/** /expense — подсказка по вводу траты. */
export async function handleExpense(ctx: Context): Promise<void> {
  await ctx.reply(
    'Внеси трату. Напиши, например:\n' +
      '• «кофе 150»\n' +
      '• «такси 340 болт»\n' +
      '• «15$ такси»'
  );
}

/** /cancel — отменить текущий ввод/ожидающую операцию. */
export async function handleCancelCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (telegramId !== undefined && cancelPending(telegramId)) {
    await ctx.reply('✖️ Отменено, ничего не сохранено.');
  } else {
    await ctx.reply('Нет ожидающей операции для отмены.');
  }
}

/** /backup — отправляет JSON-файл с данными. */
export async function handleBackup(ctx: Context): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    await ctx.reply('⚠️ База данных не подключена.');
    return;
  }
  try {
    const [accounts, categories, transactions, recurring, settings] = await Promise.all([
      fetchAccounts(supabase),
      fetchCategories(supabase),
      fetchTransactions(supabase),
      fetchRecurring(supabase),
      fetchSettings(supabase),
    ]);
    const backup = {
      exported_at: new Date().toISOString(),
      accounts,
      categories,
      transactions,
      recurring_payments: recurring,
      settings,
    };
    const json = JSON.stringify(backup, null, 2);
    const file = new InputFile(Buffer.from(json, 'utf8'), 'backup.json');
    await ctx.replyWithDocument(file, { caption: '📦 Резервная копия данных' });
  } catch (err) {
    console.error('[backup] ошибка:', err instanceof Error ? err.message : err);
    await ctx.reply('❌ Не удалось создать бэкап.');
  }
}

/** /recurring — подсказка по добавлению регулярного платежа. */

export async function handleRecurring(ctx: Context): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    await ctx.reply('⚠️ База данных не подключена.');
    return;
  }
  try {
    const accounts = await fetchAccounts(supabase);
    const list = accounts.map((a) => ({ id: a.id, name: a.name }));
    startRecurringDialog(ctx, list);
  } catch (err) {
    console.error('[recurring] ошибка:', err instanceof Error ? err.message : err);
    await ctx.reply('❌ Не удалось начать диалог.');
  }
}


export async function handleUndo(ctx: Context): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    await ctx.reply('⚠️ База данных не подключена.');
    return;
  }
  const telegramId = ctx.from?.id;
  if (telegramId === undefined) return;
  try {
    const user = await fetchUserByTelegramId(supabase, telegramId);
    if (!user) {
      await ctx.reply('Тебя нет в базе.');
      return;
    }
    const deleted = await deleteLastTransaction(supabase, user.id);
    if (!deleted) {
      await ctx.reply('Нет операций для удаления.');
      return;
    }
    await ctx.reply(`✅ Удалена последняя операция: ${deleted.description ?? 'без описания'} — ${deleted.amount}`);
  } catch (err) {
    console.error('[undo] ошибка:', err instanceof Error ? err.message : err);
    await ctx.reply('❌ Не удалось удалить операцию.');
  }
}
