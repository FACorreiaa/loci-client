// "Today" on a trip: which planned day it is, and the stop to head for next.
// When a trip covers today the desk leads with it instead of the prompt box.
import type { Trip, TripDay, TripStop } from "~/lib/api/trips";
import { parseTripDate } from "~/lib/trip-format";
import { startOfDay, tripStartDate } from "./next-trip";

export interface TripToday {
  trip: Trip;
  day: TripDay;
  /** The first stop still ahead by start time, else the day's first stop. */
  next?: TripStop;
}

const sameDay = (a: Date, b: Date): boolean => startOfDay(a).getTime() === startOfDay(b).getTime();

const nextStop = (stops: TripStop[], now: Date): TripStop | undefined => {
  if (stops.length === 0) return undefined;
  const minute = now.getHours() * 60 + now.getMinutes();
  const ordered = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
  return ordered.find((s) => s.startMinute !== undefined && s.startMinute >= minute) ?? ordered[0];
};

/** Today's planned day on `trip`, or undefined when the trip does not cover today. */
export const todayOf = (trip: Trip, now: Date): TripToday | undefined => {
  const day = trip.days.find((d) => {
    const date = parseTripDate(d.date);
    return date !== undefined && sameDay(date, now);
  });
  if (!day) return undefined;
  return { trip, day, next: nextStop(day.stops, now) };
};

/** The trip day to lead with: with overlapping trips, the one that started last. */
export const pickToday = (trips: Trip[], now: Date): TripToday | undefined =>
  trips
    .map((trip) => todayOf(trip, now))
    .filter((t): t is TripToday => t !== undefined)
    .sort(
      (a, b) => (tripStartDate(b.trip)?.getTime() ?? 0) - (tripStartDate(a.trip)?.getTime() ?? 0),
    )[0];
