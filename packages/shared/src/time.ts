import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Модуль времени. Единственное место, где считаются «сутки», недели и месяцы.
 *
 * Правила (PROJECT_RULES / DATABASE.md):
 *  - Храним время в UTC (timestamptz).
 *  - Но «сегодня», «вчера», «эта неделя», «этот месяц» считаются по Europe/Kyiv.
 *  - Нигде больше нельзя вызывать date-fns/Date «напрямую» для границ суток.
 */

export const DEFAULT_TIMEZONE = 'Europe/Kyiv';

const ISO_DATE = 'yyyy-MM-dd';

/** Текущий момент времени (UTC-инстант). */
export function now(): Date {
  return new Date();
}

/** Текущий момент в формате ISO-строки (для записи в БД). */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Дата (или ISO-строка) → «YYYY-MM-DD» в указанной зоне. */
export function toYmd(date: Date | string = new Date(), timezone: string = DEFAULT_TIMEZONE): string {
  const value = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(value, timezone, ISO_DATE);
}

/** «YYYY-MM-DD» сегодня в указанной зоне. */
export function todayYmd(timezone: string = DEFAULT_TIMEZONE): string {
  return toYmd(new Date(), timezone);
}

/** UTC-инстант начала календарных суток (00:00 по зоне). */
export function startOfDay(date: Date | string = new Date(), timezone: string = DEFAULT_TIMEZONE): Date {
  return fromZonedTime(`${toYmd(date, timezone)}T00:00:00`, timezone);
}

/** UTC-инстант окончания суток (23:59:59.999 по зоне). */
export function endOfDay(date: Date | string = new Date(), timezone: string = DEFAULT_TIMEZONE): Date {
  const next = addDays(startOfDay(date, timezone), 1);
  return new Date(next.getTime() - 1);
}

/** UTC-инстант начала следующих суток. */
export function startOfNextDay(date: Date | string = new Date(), timezone: string = DEFAULT_TIMEZONE): Date {
  return addDays(startOfDay(date, timezone), 1);
}

/** Прибавить N календарных дней к «YYYY-MM-DD» (возвращает «YYYY-MM-DD»). Чисто календарно, без зоны машины. */
export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(base.getUTCDate()).padStart(2, '0')}`;
}

/** Календарная разница в днях между двумя «YYYY-MM-DD» (b − a). */
export function daysBetweenYmd(fromYmd: string, toYmdValue: string): number {
  return differenceInCalendarDays(parseISO(`${toYmdValue}T00:00:00`), parseISO(`${fromYmd}T00:00:00`));
}

function formatYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type DateRange = { from: Date | null; to: Date | null };

export type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'prev_month' | 'all';

/**
 * Готовые диапазоны для фильтров дашборда.
 * Возвращает границы по Europe/Kyiv (UTC-инстанты), готовые для сравнения с occurred_at.
 */
export function rangeForPreset(
  preset: DatePreset,
  timezone: string = DEFAULT_TIMEZONE,
  reference: Date = new Date()
): DateRange {
  const refYmd = toYmd(reference, timezone);

  switch (preset) {
    case 'today':
      return { from: startOfDay(reference, timezone), to: endOfDay(reference, timezone) };
    case 'yesterday': {
      const y = addDaysYmd(refYmd, -1);
      return { from: startOfDay(y, timezone), to: endOfDay(y, timezone) };
    }
    case 'week': {
      // Неделя начинается в понедельник (ISO).
      const dayIndex = (parseISO(`${refYmd}T00:00:00`).getDay() + 6) % 7;
      const weekStartYmd = addDaysYmd(refYmd, -dayIndex);
      return { from: startOfDay(weekStartYmd, timezone), to: endOfDay(refYmd, timezone) };
    }
    case 'month': {
      const monthStartYmd = `${refYmd.slice(0, 7)}-01`;
      return { from: startOfDay(monthStartYmd, timezone), to: endOfDay(refYmd, timezone) };
    }
    case 'prev_month': {
      const firstOfMonth = parseISO(`${refYmd.slice(0, 7)}-01T00:00:00`);
      const prevMonthLastDay = addDays(firstOfMonth, -1);
      const prevMonthStart = new Date(prevMonthLastDay.getFullYear(), prevMonthLastDay.getMonth(), 1);
      const fromYmd = formatYmd(prevMonthStart);
      const toYmdValue = formatYmd(prevMonthLastDay);
      return { from: startOfDay(fromYmd, timezone), to: endOfDay(toYmdValue, timezone) };
    }
    case 'all':
    default:
      return { from: null, to: null };
  }
}

/** «YYYY-MM» текущего месяца. */
export function currentMonthKey(timezone: string = DEFAULT_TIMEZONE, reference: Date = new Date()): string {
  return toYmd(reference, timezone).slice(0, 7);
}

/** Проверяет, попадает ли ISO-дата в границы (включительно). */
export function isWithinRange(isoDate: string, range: DateRange): boolean {
  const t = parseISO(isoDate).getTime();
  if (range.from && t < range.from.getTime()) return false;
  if (range.to && t > range.to.getTime()) return false;
  return true;
}
