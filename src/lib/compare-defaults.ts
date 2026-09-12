/**
 * Date helpers for the compare form.
 *
 * These live outside the route because they were previously computed once at
 * component scope — `const weekend = defaultWeekend()` — which froze the window
 * for the life of the page. A tab left open past Saturday went on comparing a
 * weekend that had already happened. Pulling them out makes them both reactive
 * at the call site and testable, which matters because the "which Saturday"
 * arithmetic is the kind that is wrong for exactly one day a week.
 */

export interface DateWindow {
  start: Date;
  end: Date;
}

/** The upcoming Saturday to Sunday. Always in the future, never today. */
export function defaultWeekend(now: Date = new Date()): DateWindow {
  return weekendAfter(now, 0);
}

/** The weekend after next. */
export function nextWeekend(now: Date = new Date()): DateWindow {
  return weekendAfter(now, 1);
}

function weekendAfter(now: Date, weeksAhead: number): DateWindow {
  const day = now.getDay();
  // `|| 7` is what keeps this in the future: on a Saturday the modulo is 0,
  // and without it "this weekend" would mean the morning that is already
  // half gone.
  const daysUntilSat = ((6 - day + 7) % 7 || 7) + weeksAhead * 7;

  const start = new Date(now);
  start.setDate(now.getDate() + daysUntilSat);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  end.setHours(23, 59, 0, 0);

  return { start, end };
}

/** Formats a date for an `<input type="date">`, which wants local YYYY-MM-DD. */
export function toDateInputValue(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Reads a date input back. Parsed as local time rather than through
 * `new Date("2026-09-19")`, which ISO-parses to UTC midnight and lands on the
 * previous day for anyone west of Greenwich.
 */
export function fromDateInputValue(value: string, endOfDay = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 0, 0);
  return d;
}

/** Human label for a window, e.g. "Sat 19 – Sun 20 Sep". */
export function formatWindow(window: DateWindow): string {
  const day = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" });
  const withMonth = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${day.format(window.start)} – ${withMonth.format(window.end)}`;
}
