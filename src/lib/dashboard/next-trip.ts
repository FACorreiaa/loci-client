// Which trip the dashboard puts first, and the words around it.
import type { Trip } from "~/lib/api/trips";
import { formatTripDates, parseTripDate } from "~/lib/trip-format";

type Dated = Pick<Trip, "days">;

export interface NextTrip {
  trip: Trip;
  /** True when the trip is ahead or underway; false when it is the latest past route. */
  upcoming: boolean;
}

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const dayDates = (trip: Dated): Date[] =>
  trip.days.map((d) => parseTripDate(d.date)).filter((d): d is Date => d !== undefined);

export const tripStartDate = (trip: Dated): Date | undefined => {
  const dates = dayDates(trip);
  if (dates.length === 0) return undefined;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
};

export const tripEndDate = (trip: Dated): Date | undefined => {
  const dates = dayDates(trip);
  if (dates.length === 0) return undefined;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
};

const MS_PER_DAY = 86_400_000;

/** Calendar days from `now` to the trip's first day. Negative while underway. */
export const daysUntil = (trip: Dated, now: Date): number | undefined => {
  const start = tripStartDate(trip);
  if (!start) return undefined;
  return Math.round((startOfDay(start).getTime() - startOfDay(now).getTime()) / MS_PER_DAY);
};

export const untilLabel = (days: number | undefined): string | undefined => {
  if (days === undefined) return undefined;
  if (days < 0) return "underway";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
};

const updatedAtMs = (trip: Trip): number => {
  const t = new Date(trip.updatedAt || trip.createdAt).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * The trip that belongs at the top: the soonest one that has not ended yet,
 * else the most recently touched. Undated trips only win when nothing is dated.
 */
export const pickNextTrip = (trips: Trip[], now: Date): NextTrip | undefined => {
  if (trips.length === 0) return undefined;
  const today = startOfDay(now).getTime();

  const ahead = trips
    .map((trip) => ({ trip, start: tripStartDate(trip), end: tripEndDate(trip) }))
    .filter((t): t is { trip: Trip; start: Date; end: Date } => !!t.start && !!t.end)
    .filter((t) => startOfDay(t.end).getTime() >= today)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (ahead.length > 0) return { trip: ahead[0].trip, upcoming: true };

  const latest = [...trips].sort((a, b) => updatedAtMs(b) - updatedAtMs(a))[0];
  return { trip: latest, upcoming: false };
};

export const tripDateRange = (trip: Dated): string | undefined => formatTripDates(trip.days);

/** Where the trip is, for a forecast: the first day that carries a city position. */
export const tripCoords = (trip: Dated): { lat: number; lon: number } | undefined => {
  const day = trip.days.find((d) => typeof d.cityLat === "number" && typeof d.cityLon === "number");
  return day ? { lat: day.cityLat!, lon: day.cityLon! } : undefined;
};

export const tripStopCount = (trip: Dated): number =>
  trip.days.reduce((n, d) => n + d.stops.length, 0);

/** Every other trip, newest first, for the "other routes" list. */
export const otherTrips = (trips: Trip[], excludeId: string | undefined, limit = 4): Trip[] =>
  trips
    .filter((t) => t.id !== excludeId)
    .sort((a, b) => updatedAtMs(b) - updatedAtMs(a))
    .slice(0, limit);
