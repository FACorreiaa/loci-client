/**
 * Trip Kit — turn a planned itinerary into phone-ready artifacts:
 * Google Maps multi-stop directions, calendar (.ics), and day grouping.
 *
 * Free tier is intentionally limited to day 1 so the full multi-day kit is
 * the Pro unlock at the emotional peak after generation.
 */

export const FREE_STOPS_PER_DAY = 4;

export interface TripStop {
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  category?: string;
  blurb?: string;
  timeToSpend?: string;
  day?: number;
  /** Minutes to allocate for this stop (parsed or default). */
  durationMinutes?: number;
}

export interface TripDay {
  day: number;
  label: string;
  stops: TripStop[];
}

export interface TripKitInput {
  title: string;
  cityName: string;
  summary?: string;
  stops: TripStop[];
  /** Group size when stops lack explicit day numbers. Default FREE_STOPS_PER_DAY. */
  stopsPerDay?: number;
  /** When free, only day 0 is unlocked for full export actions. */
  isPro: boolean;
}

function validCoord(lat?: number, lon?: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    !(lat === 0 && lon === 0)
  );
}

/** Group ordered stops into days. */
export function groupStopsByDay<T extends TripStop>(
  stops: T[],
  stopsPerDay: number = FREE_STOPS_PER_DAY,
): (Omit<TripDay, "stops"> & { stops: T[] })[] {
  if (stops.length === 0) return [];
  const hasExplicitDays = stops.some((s) => typeof s.day === "number");
  if (hasExplicitDays) {
    const map = new Map<number, T[]>();
    for (const s of stops) {
      const d = s.day ?? 0;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(s);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, dayStops], position) => ({
        day,
        // Numbered by position, not by the value. The server numbers days from
        // 1, so `day + 1` rendered a four-day trip as "Day 2" through "Day 5"
        // with no Day 1 at all. Position is right whichever base the server
        // uses, and keeps sparse or non-contiguous days reading consecutively.
        label: `Day ${position + 1}`,
        stops: dayStops,
      }));
  }
  const groups: (Omit<TripDay, "stops"> & { stops: T[] })[] = [];
  stops.forEach((s, i) => {
    const day = Math.floor(i / Math.max(1, stopsPerDay));
    if (!groups[day]) groups[day] = { day, label: `Day ${day + 1}`, stops: [] };
    groups[day].stops.push({ ...s, day });
  });
  return groups;
}

/**
 * The days an export covers, as positions in the day list. Positions rather
 * than dates: Day 1's date can change under them, and the same days stay
 * selected while their dates move.
 */
export interface TripDayRange {
  from: number;
  to: number;
}

export function fitDayRange(range: TripDayRange, dayCount: number): TripDayRange {
  const last = Math.max(dayCount - 1, 0);
  const from = Math.min(Math.max(range.from, 0), last);
  return { from, to: Math.min(Math.max(range.to, from), last) };
}

export const allDays = (dayCount: number): TripDayRange =>
  fitDayRange({ from: 0, to: dayCount - 1 }, dayCount);

/** From moves freely; moved past To, it brings To along. */
export function moveRangeFrom(range: TripDayRange, index: number, dayCount: number): TripDayRange {
  const last = Math.max(dayCount - 1, 0);
  const from = Math.min(Math.max(index, 0), last);
  return fitDayRange({ from, to: Math.max(range.to, from) }, dayCount);
}

/** To can't go before From. */
export function moveRangeTo(range: TripDayRange, index: number, dayCount: number): TripDayRange {
  return fitDayRange({ from: range.from, to: index }, dayCount);
}

export function sliceDays<T>(days: T[], range: TripDayRange): T[] {
  return days.slice(range.from, range.to + 1);
}

/** Calendar arithmetic, not 24-hour steps: a day isn't always 24 hours long. */
export function dateOfDay(start: Date, index: number): Date {
  const d = new Date(start);
  d.setDate(start.getDate() + index);
  return d;
}

/** Which position a picked date falls on, inside the trip. */
export function dayIndexOf(date: Date, start: Date, dayCount: number): number {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = Math.round((utc(date) - utc(start)) / 86_400_000);
  return Math.min(Math.max(offset, 0), Math.max(dayCount - 1, 0));
}

/** A `yyyy-mm-dd` value for a date input, in local time. */
export function dateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Day 1's date for a trip whose days are pinned: the first dated day, walked
 * back by its number. Undefined for a relative "Day N" plan.
 */
export function pinnedTripStart(
  days: { dayNumber: number; date?: string }[],
  parse: (iso?: string) => Date | undefined,
): string | undefined {
  for (const day of days) {
    const date = parse(day.date);
    if (date) return dateInputValue(dateOfDay(date, 1 - day.dayNumber));
  }
  return undefined;
}

/** Stops unlocked for free users (day 1 only). Pro gets all. */
export function unlockedStops(input: TripKitInput): TripStop[] {
  const days = groupStopsByDay(input.stops, input.stopsPerDay ?? FREE_STOPS_PER_DAY);
  if (input.isPro) return days.flatMap((d) => d.stops);
  return days[0]?.stops ?? [];
}

export function lockedDayCount(input: TripKitInput): number {
  const days = groupStopsByDay(input.stops, input.stopsPerDay ?? FREE_STOPS_PER_DAY);
  if (input.isPro) return 0;
  return Math.max(0, days.length - 1);
}

/**
 * Google Maps directions URL for an ordered set of stops.
 * Uses lat,lon when available; falls back to name + city as a place query.
 * Google caps intermediate waypoints; we keep origin + destination + up to 8 via.
 */
/** A place a map link can point at. */
export interface MapPlace {
  latitude?: number;
  longitude?: number;
  name?: string;
}

/**
 * Google Maps link for one place, or null when we do not know where it is.
 *
 * Null is the point: only coordinates the server resolved from a real database
 * row are trustworthy. An ungrounded answer carries coordinates the model
 * invented, and a link built on those opens the wrong street confidently. The
 * caller renders nothing rather than lying.
 */
export function buildGoogleMapsUrl(place: MapPlace): string | null {
  if (!validCoord(place.latitude, place.longitude)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
}

/**
 * Apple Maps link for one place, or null when we do not know where it is.
 *
 * `maps.apple.com` opens the native app on Apple devices and falls back to the
 * web elsewhere, so both links can be offered without sniffing the platform.
 * The name rides along as `q` because Apple labels the dropped pin with it.
 */
export function buildAppleMapsUrl(place: MapPlace): string | null {
  if (!validCoord(place.latitude, place.longitude)) return null;
  const label = place.name?.trim();
  const q = label ? `&q=${encodeURIComponent(label)}` : "";
  return `https://maps.apple.com/?ll=${place.latitude},${place.longitude}${q}`;
}

export function buildGoogleMapsMultiStopUrl(stops: TripStop[], cityName: string): string | null {
  const usable = stops.filter(
    (s) => validCoord(s.latitude, s.longitude) || (s.name && s.name.trim().length > 0),
  );
  if (usable.length === 0) return null;

  const place = (s: TripStop): string => {
    if (validCoord(s.latitude, s.longitude)) {
      return `${s.latitude},${s.longitude}`;
    }
    const q = [s.name, s.address, cityName].filter(Boolean).join(", ");
    return encodeURIComponent(q);
  };

  if (usable.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place(usable[0])}&travelmode=walking`;
  }

  const origin = place(usable[0]);
  const destination = place(usable[usable.length - 1]);
  const via = usable.slice(1, -1).slice(0, 8);
  const waypoints = via.length > 0 ? `&waypoints=${via.map((s) => place(s)).join("%7C")}` : "";

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}&travelmode=walking`;
}

/**
 * Apple Maps walking directions URL for an ordered set of stops.
 *
 * Apple Maps' URL scheme only supports a single origin → destination pair.
 * For multi-stop routes we chain intermediate stops using the
 * `daddr=<addr>+to:<addr>` chaining syntax that Apple Maps web accepts.
 * Coordinates are used when available; name + city is the fallback.
 *
 * Returns null when no stop has usable coordinates or a name.
 */
export function buildAppleMapsMultiStopUrl(stops: TripStop[], cityName: string): string | null {
  const usable = stops.filter(
    (s) => validCoord(s.latitude, s.longitude) || (s.name && s.name.trim().length > 0),
  );
  if (usable.length === 0) return null;

  // For a single stop, delegate to the single-place helper.
  if (usable.length === 1) {
    return buildAppleMapsUrl({
      latitude: usable[0].latitude,
      longitude: usable[0].longitude,
      name: usable[0].name,
    });
  }

  const addr = (s: TripStop): string => {
    if (validCoord(s.latitude, s.longitude)) {
      const label = s.name?.trim() ? encodeURIComponent(s.name) : "";
      return label ? `${s.latitude},${s.longitude}+${label}` : `${s.latitude},${s.longitude}`;
    }
    const q = [s.name, s.address, cityName].filter(Boolean).join(", ");
    return encodeURIComponent(q);
  };

  const origin = addr(usable[0]);
  // Chain middle and final stops with the " to:" separator Apple Maps web understands.
  const rest = usable
    .slice(1)
    .map((s) => addr(s))
    .join("+to:");
  const daddr = encodeURIComponent(rest);

  return `https://maps.apple.com/?saddr=${origin}&daddr=${daddr}&dirflg=w`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Format a local Date as a bare calendar date string for iCalendar VALUE=DATE
 * fields (YYYYMMDD). All-day events must NOT use DATE-TIME or a UTC suffix.
 */
function toIcsDate(date: Date): string {
  return `${date.getFullYear()}` + `${pad(date.getMonth() + 1)}` + `${pad(date.getDate())}`;
}

/** Format a Date as UTC iCalendar DATE-TIME (YYYYMMDDTHHMMSSZ). */
export function toIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function parseDurationMinutes(timeToSpend?: string): number {
  if (!timeToSpend) return 90;
  const lower = timeToSpend.toLowerCase();
  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*h/);
  const minMatch = lower.match(/(\d+)\s*m/);
  let mins = 0;
  if (hourMatch) mins += Math.round(parseFloat(hourMatch[1]) * 60);
  if (minMatch) mins += parseInt(minMatch[1], 10);
  if (mins > 0) return Math.min(Math.max(mins, 30), 240);
  const bare = lower.match(/(\d+)/);
  if (bare) {
    const n = parseInt(bare[1], 10);
    // Heuristic: numbers ≤ 8 are hours, else minutes
    return n <= 8 ? n * 60 : Math.min(n, 240);
  }
  return 90;
}

/**
 * Read a `yyyy-mm-dd` value from a date input as a local day.
 *
 * `new Date("2026-10-08")` is parsed as midnight UTC, which is the 7th
 * anywhere west of Greenwich — so the obvious one-liner moves somebody's trip
 * a day earlier depending on where they are sitting. Constructing from the
 * parts keeps the day the one they picked.
 *
 * Returns null for anything that is not a real date, so a half-typed input
 * cannot silently produce an Invalid Date and an .ics full of NaN.
 */
export function parseLocalDate(value: string, dayStartHour: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day, dayStartHour, 0, 0, 0);
  // Rejects 2026-13-45: the Date constructor rolls those over rather than
  // failing, so compare the parts back.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * "Wed 8 – Sat 11 Oct", so the page can say what it is about to write into
 * the calendar before anybody downloads it.
 */
export function tripDateRange(startDate: Date, dayCount: number): string {
  if (dayCount <= 0) return "";
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  if (dayCount === 1) return fmt(startDate);
  const end = new Date(startDate);
  end.setDate(startDate.getDate() + dayCount - 1);
  return `${fmt(startDate)} \u2013 ${fmt(end)}`;
}

export interface CalendarOptions {
  /** Local start of the first exported day (defaults to tomorrow 09:00 local). */
  startDate?: Date;
  dayStartHour?: number;
  /**
   * The number the first exported day goes by. A range starting at Day 3 keeps
   * calling it Day 3, where position alone would relabel it Day 1.
   */
  firstDayNumber?: number;
}

/**
 * Build a multi-day .ics calendar from itinerary stops.
 * Free callers should pass only unlocked (day-1) stops.
 */
export function buildItineraryIcs(
  input: Pick<TripKitInput, "title" | "cityName" | "summary" | "stops" | "stopsPerDay">,
  options: CalendarOptions = {},
): string {
  const dayStartHour = options.dayStartHour ?? 9;
  const base =
    options.startDate ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(dayStartHour, 0, 0, 0);
      return d;
    })();

  const days = groupStopsByDay(input.stops, input.stopsPerDay ?? FREE_STOPS_PER_DAY);
  const firstDayNumber = options.firstDayNumber ?? 1;
  const now = toIcsUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Loci//Trip Kit//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(input.title || `${input.cityName} Trip`)}`,
  ];

  const slugCity = slug(input.cityName) || "trip";

  days.forEach((day, dayIndex) => {
    let cursor = new Date(base);
    cursor.setDate(base.getDate() + dayIndex);
    cursor.setHours(dayStartHour, 0, 0, 0);

    // All-day umbrella event for this day (RFC 5545 §3.6.1: all-day events
    // use VALUE=DATE and DTEND is the *next* calendar day, exclusive).
    const dayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayIndex);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const stopNames = day.stops.map((s) => s.name).join(" · ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:loci-day-${day.day}-${slugCity}@loci.app`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${toIcsDate(dayStart)}`,
      `DTEND;VALUE=DATE:${toIcsDate(dayEnd)}`,
      `SUMMARY:${escapeIcsText(`${input.title || input.cityName} \u2014 Day ${firstDayNumber + dayIndex}`)}`,
      `DESCRIPTION:${escapeIcsText(stopNames)}`,
      "END:VEVENT",
    );

    day.stops.forEach((stop, stopIndex) => {
      const duration = stop.durationMinutes ?? parseDurationMinutes(stop.timeToSpend);
      const start = new Date(cursor);
      const end = new Date(cursor.getTime() + duration * 60_000);
      const uid = `loci-${day.day}-${stopIndex}-${slug(stop.name)}@loci.app`;
      const location =
        stop.address ||
        (validCoord(stop.latitude, stop.longitude)
          ? `${stop.latitude},${stop.longitude}`
          : `${stop.name}, ${input.cityName}`);
      const desc = [stop.blurb, stop.category, stop.timeToSpend].filter(Boolean).join(" · ");

      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${toIcsUtc(start)}`,
        `DTEND:${toIcsUtc(end)}`,
        `SUMMARY:${escapeIcsText(stop.name)}`,
        `LOCATION:${escapeIcsText(location)}`,
        `DESCRIPTION:${escapeIcsText(desc || input.summary || "")}`,
        "END:VEVENT",
      );

      // 15 min walk buffer between stops
      cursor = new Date(end.getTime() + 15 * 60_000);
    });
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

/** Trigger browser download of an .ics file. */
export function downloadIcs(icsBody: string, filename: string): void {
  const blob = new Blob([icsBody], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Open Google Maps for the unlocked portion of the trip. */
/**
 * One day's route URLs. A maps route has no date and Google takes about ten
 * stops, so a range is a route per day rather than one long walk.
 */
export function dayRouteUrls(
  stops: TripStop[],
  cityName: string,
): { google: string | null; apple: string | null } {
  return {
    google: buildGoogleMapsMultiStopUrl(stops, cityName),
    apple: buildAppleMapsMultiStopUrl(stops, cityName),
  };
}

export function downloadCalendarForTrip(
  input: TripKitInput,
  options: CalendarOptions = {},
  range?: TripDayRange,
): { ok: boolean; locked: boolean } {
  const unlocked = groupStopsByDay(unlockedStops(input), input.stopsPerDay ?? FREE_STOPS_PER_DAY);
  const days = range ? sliceDays(unlocked, range) : unlocked;
  // Flattened from the groups, which have numbered chunked stops by now: a
  // range cut from the flat list would re-chunk from its own first stop.
  const stops = days.flatMap((d) => d.stops);
  if (stops.length === 0) return { ok: false, locked: false };
  const ics = buildItineraryIcs(
    {
      title: input.title,
      cityName: input.cityName,
      summary: input.summary,
      stops,
      stopsPerDay: input.stopsPerDay,
    },
    { ...options, firstDayNumber: (range?.from ?? 0) + 1 },
  );
  const slugCity2 = slug(input.cityName) || "trip";
  downloadIcs(ics, `loci-${slugCity2}-${calendarFileSuffix(input, unlocked.length, range)}.ics`);
  return { ok: true, locked: lockedDayCount(input) > 0 };
}

/** "full" and "day1" as ever; a narrowed range says which days it holds. */
function calendarFileSuffix(input: TripKitInput, dayCount: number, range?: TripDayRange): string {
  if (range && (range.from > 0 || range.to < dayCount - 1)) {
    return range.from === range.to
      ? `day${range.from + 1}`
      : `days${range.from + 1}-${range.to + 1}`;
  }
  return input.isPro ? "full" : "day1";
}
