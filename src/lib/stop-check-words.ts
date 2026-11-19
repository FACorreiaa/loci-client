/**
 * The words a stop's check is shown with.
 *
 * Apart from stop-check.ts so that the pages that carry checks do not carry
 * the wording too: it is loaded with the stamp, the first time a stamp is
 * drawn. See components/itinerary/LazyCheck.tsx.
 */
import { ATTENTION, type StopCheck } from "./stop-check";

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
