/**
 * What the map says about a stop's place, and the words it is shown with.
 *
 * Two facts are kept apart on purpose. `status` says the place was found on a
 * real map. `hours` says what its listed opening hours mean for the planned
 * visit. "Checked" only ever means the first: a place can be found with no
 * hours listed, and the copy below never lets that read as "confirmed open".
 */

export type StopCheckStatus = "checked" | "not_found";

export type StopHours =
  | "not_listed"
  | "unreadable"
  | "listed"
  | "open_that_day"
  | "open"
  | "shut_that_day"
  | "opens_later"
  | "closes_early"
  | "shut_by_then";

export interface StopCheck {
  status: StopCheckStatus;
  hours: StopHours;
  /** Minutes from midnight on the day of the visit. */
  opensMinute?: number;
  /** Above 1440 when the place stays open past midnight. */
  closesMinute?: number;
  /** The public holiday the visit falls on, in the local language. */
  holidayName?: string;
  /** The day is a holiday and the map lists no holiday hours. */
  holidayHoursUnknown?: boolean;
  source?: string;
  checkedAt?: string; // ISO
}

/** The wire shape: the generated message, read structurally. */
export interface StopCheckWire {
  status: number;
  hours: number;
  opensMinute?: number;
  closesMinute?: number;
  holidayName: string;
  holidayHoursUnknown: boolean;
  source: string;
  checkedAt?: { seconds: bigint; nanos: number };
}

// StopHoursState, by its number on the wire.
const HOURS: StopHours[] = [
  "not_listed",
  "unreadable",
  "listed",
  "open_that_day",
  "open",
  "shut_that_day",
  "opens_later",
  "closes_early",
  "shut_by_then",
];

/**
 * Maps the wire message. A stop the server has not looked up (no message, or
 * status unspecified) has no check, and shows no stamp.
 */
export const stopCheckFromWire = (c?: StopCheckWire): StopCheck | undefined => {
  if (!c) return undefined;
  const status: StopCheckStatus | undefined =
    c.status === 1 ? "checked" : c.status === 2 ? "not_found" : undefined;
  if (!status) return undefined;
  return {
    status,
    // An hours value this build does not know is treated as unreadable: it is
    // the one answer that claims nothing.
    hours: status === "checked" ? (HOURS[c.hours] ?? "unreadable") : "not_listed",
    opensMinute: c.opensMinute,
    closesMinute: c.closesMinute,
    holidayName: c.holidayName || undefined,
    holidayHoursUnknown: c.holidayHoursUnknown || undefined,
    source: c.source || undefined,
    checkedAt: c.checkedAt ? new Date(Number(c.checkedAt.seconds) * 1000).toISOString() : undefined,
  };
};

/**
 * `ok`: found, and nothing in its hours argues with the plan.
 * `attention`: found, and the plan as timed meets a shut door.
 * `unknown`: not found on the map. Not the same as "does not exist".
 */
export type CheckTone = "ok" | "attention" | "unknown";

export interface CheckLine {
  tone: CheckTone;
  /** The stamp itself. */
  mark: string;
  /** What the hours say, or "" when there is nothing to add. */
  detail: string;
  /** A longer sentence for the title and for screen readers. */
  explain: string;
}

const clock = (minute: number) => {
  const m = ((minute % 1440) + 1440) % 1440;
  if (m === 0) return "midnight";
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

const ATTENTION: ReadonlySet<StopHours> = new Set([
  "shut_that_day",
  "opens_later",
  "closes_early",
  "shut_by_then",
]);

export const needsAttention = (c?: StopCheck) => c?.status === "checked" && ATTENTION.has(c.hours);

/** The short weekday of an ISO date, read in UTC as the trip stores it. */
const weekdayOf = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }) : "";

/**
 * The words for one stop's check. `dayDate` is the day's ISO date, used only
 * to name the weekday a place is shut on.
 */
export const describeCheck = (c: StopCheck, dayDate?: string): CheckLine => {
  if (c.status === "not_found") {
    return {
      tone: "unknown",
      mark: "Couldn't check",
      detail: "",
      explain:
        "We could not find this place on the map. It may still be real: look it up before you go.",
    };
  }

  const all = c.opensMinute === 0 && c.closesMinute === 1440;
  const day = weekdayOf(dayDate);
  let detail = "";
  let explain = "Found on the map.";

  switch (c.hours) {
    case "not_listed":
      detail = "hours not listed";
      explain = "Found on the map. The map lists no opening hours for it.";
      break;
    case "unreadable":
      detail = "hours vary";
      explain =
        "Found on the map. Its hours change by season or need arranging, so check them before you go.";
      break;
    case "listed":
      detail = "set a date to check hours";
      explain = "Found on the map. Give this day a date and we will hold its hours to your plan.";
      break;
    case "open_that_day":
      detail = "open that day";
      explain = "Found on the map, and open on this day. Give the stop a time to check it.";
      break;
    case "open":
      detail = all
        ? "always open"
        : c.closesMinute != null
          ? `open until ${clock(c.closesMinute)}`
          : "open";
      explain = "Found on the map, and open for the whole of your visit.";
      break;
    case "shut_that_day":
      detail = day ? `shut ${day}` : "shut that day";
      explain = "Found on the map, but shut all day on the day you planned it.";
      break;
    case "opens_later":
      detail = c.opensMinute != null ? `opens ${clock(c.opensMinute)}` : "opens later";
      explain = "Found on the map, but not yet open at the time you planned.";
      break;
    case "closes_early":
      detail = c.closesMinute != null ? `shuts ${clock(c.closesMinute)}` : "shuts early";
      explain = "Found on the map, but it shuts before your visit ends.";
      break;
    case "shut_by_then":
      detail = c.closesMinute != null ? `shut from ${clock(c.closesMinute)}` : "shut by then";
      explain = "Found on the map, but already shut for the day by the time you planned.";
      break;
  }

  if (c.holidayName) {
    detail += c.holidayHoursUnknown
      ? ` · ${c.holidayName}, hours may differ`
      : ` · ${c.holidayName}`;
    if (c.holidayHoursUnknown) {
      explain += ` This day is a public holiday (${c.holidayName}) and the map lists no holiday hours.`;
    }
  }

  return { tone: ATTENTION.has(c.hours) ? "attention" : "ok", mark: "Checked", detail, explain };
};

export interface DayTally {
  /** Stops whose place was found on the map. */
  checked: number;
  /** Stops that carry a check at all. */
  total: number;
  needAttention: number;
}

/** Sums a day's stops. Stops with no check are not counted either way. */
export const tallyChecks = (stops: { check?: StopCheck }[]): DayTally => {
  const t: DayTally = { checked: 0, total: 0, needAttention: 0 };
  for (const s of stops) {
    if (!s.check) continue;
    t.total++;
    if (s.check.status === "checked") {
      t.checked++;
      if (needsAttention(s.check)) t.needAttention++;
    }
  }
  return t;
};

/**
 * True for a plan whose places the server has not answered for yet: it has
 * stops with a place behind them and none carries a check. The server looks
 * places up behind the response that first shows them, so such a plan is
 * worth reading once more a little later. Also true wherever checks are
 * switched off, which is why a caller asks again once and not on a loop.
 */
export const awaitingChecks = (days: { stops: { poiId?: string; check?: StopCheck }[] }[]) => {
  const stops = days.flatMap((d) => d.stops);
  return stops.some((s) => s.poiId) && !stops.some((s) => s.check);
};
