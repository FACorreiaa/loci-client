import type { Trip, TripDay } from "~/lib/api/trips";
import { parseTripDate } from "~/lib/trip-format";

export type CalendarTripBlock = {
  tripId: string;
  title: string;
  cityName: string;
  dayNumber: number;
  dateKey: string;
};

export type MonthCell = {
  dateKey: string;
  inMonth: boolean;
  day: number;
};

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayDateKey(day: TripDay): string | undefined {
  const parsed = parseTripDate(day.date);
  return parsed ? dateKey(parsed) : undefined;
}

export function tripBlocksOnCalendar(trips: Trip[]): CalendarTripBlock[] {
  const blocks: CalendarTripBlock[] = [];
  for (const trip of trips) {
    for (const day of trip.days) {
      const key = dayDateKey(day);
      if (!key) continue;
      blocks.push({
        tripId: trip.id,
        title: trip.title || (trip.cityName ? `Trip to ${trip.cityName}` : "Untitled trip"),
        cityName: day.cityName || trip.cityName,
        dayNumber: day.dayNumber,
        dateKey: key,
      });
    }
  }
  return blocks;
}

export function unscheduledTrips(trips: Trip[]): Trip[] {
  return trips.filter((trip) => !trip.days.some((day) => dayDateKey(day)));
}

/** Monday-first month grid, padded to whole weeks. `month` is 0-based. */
export function monthCells(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const last = new Date(year, month + 1, 0);
  const endOffset = (7 - ((last.getDay() + 6) % 7) - 1 + 7) % 7;
  const end = new Date(year, month + 1, endOffset);
  const cells: MonthCell[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    cells.push({
      dateKey: dateKey(cursor),
      inMonth: cursor.getMonth() === month,
      day: cursor.getDate(),
    });
  }
  return cells;
}

export function pinTripDates(trip: Trip, start: Date): Trip {
  const origin = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  return {
    ...trip,
    days: trip.days.map((day) => {
      const d = new Date(origin);
      d.setDate(origin.getDate() + (day.dayNumber - 1));
      return { ...day, date: dateKey(d) };
    }),
  };
}
