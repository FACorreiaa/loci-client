/**
 * Opening hours as a week the scout edits, and the one canonical string that
 * week is sent as.
 *
 * Every field report has to be byte-identical to another scout's before the two
 * corroborate, so this encoding has exactly one form per week: all seven days
 * are always present, days are always in Monday-first order, intervals within a
 * day are sorted and merged, and consecutive days with identical hours always
 * collapse into a range. Two scouts who describe the same week through the
 * picker cannot produce two different strings.
 *
 * Times are local wall-clock at the place, zero-padded, 24-hour. A close at
 * midnight is `24:00` rather than `00:00`, so an interval always reads
 * forwards.
 */

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export interface Interval {
  /** "HH:MM", 00:00–23:59. */
  start: string;
  /** "HH:MM", 00:01–24:00. */
  end: string;
}

/** A day is either closed, or open for one or more intervals. */
export type DayHours = { closed: true } | { closed: false; intervals: Interval[] };

export type OpeningHours = Record<Day, DayHours>;

const TIME = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

/**
 * A starting week that is quick to correct. Most places are weekday-open, and
 * correcting a wrong default is less work than filling seven empty days — which
 * matters, because a half-filled week has no canonical form.
 */
export const defaultOpeningHours = (): OpeningHours => ({
  mon: { closed: false, intervals: [{ start: "09:00", end: "17:00" }] },
  tue: { closed: false, intervals: [{ start: "09:00", end: "17:00" }] },
  wed: { closed: false, intervals: [{ start: "09:00", end: "17:00" }] },
  thu: { closed: false, intervals: [{ start: "09:00", end: "17:00" }] },
  fri: { closed: false, intervals: [{ start: "09:00", end: "17:00" }] },
  sat: { closed: true },
  sun: { closed: true },
});

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
};

/** Sorts intervals and merges any that overlap or touch. */
const mergeIntervals = (intervals: Interval[]): Interval[] => {
  const sorted = [...intervals].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && toMinutes(interval.start) <= toMinutes(previous.end)) {
      if (toMinutes(interval.end) > toMinutes(previous.end)) previous.end = interval.end;
      continue;
    }
    merged.push({ ...interval });
  }
  return merged;
};

const dayIntervalsToString = (hours: DayHours): string => {
  if (hours.closed) return "closed";
  const merged = mergeIntervals(hours.intervals);
  if (merged.length === 0) return "closed";
  return merged.map((interval) => `${interval.start}-${interval.end}`).join(",");
};

/** True when every interval is a well-formed, forward-running span. */
export const isValidOpeningHours = (hours: OpeningHours): boolean =>
  DAYS.every((day) => {
    const dayHours = hours[day];
    if (dayHours.closed) return true;
    if (dayHours.intervals.length === 0) return false;
    return dayHours.intervals.every(
      (interval) =>
        TIME.test(interval.start) &&
        TIME.test(interval.end) &&
        toMinutes(interval.start) < toMinutes(interval.end),
    );
  });

/**
 * Renders the week as its canonical string, e.g.
 * `mon-fri 09:00-17:00; sat 10:00-14:00; sun closed`.
 */
export const encodeOpeningHours = (hours: OpeningHours): string => {
  const groups: string[] = [];
  let runStart = 0;

  for (let index = 0; index <= DAYS.length; index += 1) {
    const current = index < DAYS.length ? dayIntervalsToString(hours[DAYS[index]]) : null;
    const running = dayIntervalsToString(hours[DAYS[runStart]]);
    if (current === running) continue;

    const lastOfRun = index - 1;
    const daySpec =
      runStart === lastOfRun ? DAYS[runStart] : `${DAYS[runStart]}-${DAYS[lastOfRun]}`;
    groups.push(`${daySpec} ${running}`);
    runStart = index;
  }

  return groups.join("; ");
};

/**
 * Reads a canonical string back into a week, so an in-progress report survives
 * a re-render. Returns null for anything it does not recognise rather than
 * guessing — a guess here becomes a claim nobody can corroborate.
 */
export const parseOpeningHours = (value: string): OpeningHours | null => {
  const week = {} as Partial<Record<Day, DayHours>>;

  for (const rawGroup of value.split(";")) {
    const group = rawGroup.trim();
    if (group === "") continue;

    const separator = group.indexOf(" ");
    if (separator < 0) return null;
    const daySpec = group.slice(0, separator);
    const intervalSpec = group.slice(separator + 1).trim();

    const [from, to] = daySpec.split("-");
    const fromIndex = DAYS.indexOf(from as Day);
    const toIndex = to ? DAYS.indexOf(to as Day) : fromIndex;
    if (fromIndex < 0 || toIndex < 0 || toIndex < fromIndex) return null;

    let hours: DayHours;
    if (intervalSpec === "closed") {
      hours = { closed: true };
    } else {
      const intervals: Interval[] = [];
      for (const part of intervalSpec.split(",")) {
        const [start, end] = part.trim().split("-");
        if (!TIME.test(start ?? "") || !TIME.test(end ?? "")) return null;
        intervals.push({ start, end });
      }
      hours = { closed: false, intervals };
    }

    for (let index = fromIndex; index <= toIndex; index += 1) {
      week[DAYS[index]] = hours.closed
        ? { closed: true }
        : { closed: false, intervals: [...hours.intervals] };
    }
  }

  if (DAYS.some((day) => week[day] === undefined)) return null;
  return week as OpeningHours;
};
