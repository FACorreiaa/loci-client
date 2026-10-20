// "Today" on a trip: which planned day it is, and the stop to head for next.
// When a trip covers today the desk leads with it instead of the prompt box.
import type { Trip, TripDay, TripStop } from "~/lib/api/trips";
import { startOfDay, tripStartDate } from "./next-trip";

export interface TripToday {
  trip: Trip;
  day: TripDay;
  /** The first stop still ahead by start time, else the day's first stop. */
  next?: TripStop;
}

const sameDay = (a: Date, b: Date): boolean => startOfDay(a).getTime() === startOfDay(b).getTime();

// A day's date is a calendar date carried as midnight UTC ("2026-10-20T00:00:00.000Z")
// or written bare ("2026-10-20"). Either way its first ten characters name the
// day; reading the instant in local time would land on the 19th west of UTC.
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

const calendarDay = (iso?: string): Date | undefined => {
  const m = iso ? CALENDAR_DATE.exec(iso) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
};

const nextStop = (stops: TripStop[], now: Date): TripStop | undefined => {
  if (stops.length === 0) return undefined;
  const minute = now.getHours() * 60 + now.getMinutes();
  const ordered = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
  return ordered.find((s) => s.startMinute !== undefined && s.startMinute >= minute) ?? ordered[0];
};

/** Today's planned day on `trip`, or undefined when the trip does not cover today. */
export const todayOf = (trip: Trip, now: Date): TripToday | undefined => {
  const day = trip.days.find((d) => {
    const date = calendarDay(d.date);
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
