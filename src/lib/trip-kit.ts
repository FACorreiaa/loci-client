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
      .map(([day, dayStops]) => ({
        day,
        label: `Day ${day + 1}`,
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

function pad(n: number): string {
  return String(n).padStart(2, "0");
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
  /** Local start of day 1 (defaults to tomorrow 09:00 local). */
  startDate?: Date;
  dayStartHour?: number;
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
  const now = toIcsUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Loci//Trip Kit//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(input.title || `${input.cityName} Trip`)}`,
  ];

  days.forEach((day, dayIndex) => {
    let cursor = new Date(base);
    cursor.setDate(base.getDate() + dayIndex);
    cursor.setHours(dayStartHour, 0, 0, 0);

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
export function openMapsForTrip(input: TripKitInput): { ok: boolean; locked: boolean } {
  const stops = unlockedStops(input);
  const url = buildGoogleMapsMultiStopUrl(stops, input.cityName);
  if (!url) return { ok: false, locked: false };
  window.open(url, "_blank", "noopener,noreferrer");
  return { ok: true, locked: lockedDayCount(input) > 0 };
}

/**
 * Download calendar for unlocked stops.
 *
 * `options` is forwarded to buildItineraryIcs, which is the whole point: the
 * start date seam has existed on buildItineraryIcs since it was written, and
 * this function had no parameter to carry one — so every download anybody has
 * ever made started tomorrow at 09:00 regardless of when the trip was.
 */
export function downloadCalendarForTrip(
  input: TripKitInput,
  options: CalendarOptions = {},
): { ok: boolean; locked: boolean } {
  const stops = unlockedStops(input);
  if (stops.length === 0) return { ok: false, locked: false };
  const ics = buildItineraryIcs(
    {
      title: input.title,
      cityName: input.cityName,
      summary: input.summary,
      stops,
      stopsPerDay: input.stopsPerDay,
    },
    options,
  );
  const slugCity = slug(input.cityName) || "trip";
  downloadIcs(ics, `loci-${slugCity}${input.isPro ? "-full" : "-day1"}.ics`);
  return { ok: true, locked: lockedDayCount(input) > 0 };
}
