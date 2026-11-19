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

/** The hours states in which the plan as timed meets a shut door. */
export const ATTENTION: ReadonlySet<StopHours> = new Set([
  "shut_that_day",
  "opens_later",
  "closes_early",
  "shut_by_then",
]);

export const needsAttention = (c?: StopCheck) => c?.status === "checked" && ATTENTION.has(c.hours);

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
 * True when some stop's place does not open at all on the stop's day. That is
 * the one clash the server may have a fix for (a move to a day the place is
 * open), offered among the trip's suggestions.
 */
export const hasShutStop = (days: { stops: { check?: StopCheck }[] }[]) =>
  days.some((d) =>
    d.stops.some((s) => s.check?.status === "checked" && s.check.hours === "shut_that_day"),
  );

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
