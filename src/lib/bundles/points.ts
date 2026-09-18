/**
 * Turning a pack's days into points on a map.
 *
 * Kept apart from `~/lib/api/bundles` on purpose: this is pure, so it can be
 * tested without pulling in the Connect transport or solid-query.
 */

/** A stop with a position, in the shape the map component wants. */
export interface PackPoint {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  /** 0-based, to match the list's day grouping. */
  day: number;
  /** 1-based position across the whole pack. */
  seq: number;
}

/** The parts of a stop this needs. Structural, so the proto type satisfies it. */
export interface PositionedStopLike {
  id?: string;
  name?: string;
  poi?: {
    latitude?: number;
    longitude?: number;
    category?: string;
  };
}

export interface DayLike {
  dayNumber: number;
  stops: PositionedStopLike[];
}

/**
 * Collect every stop that has a position, in visiting order.
 *
 * The server hydrates a stop's stored position into `poi`, because TripStop
 * itself carries no coordinates. A stop the generator produced without one has
 * no `poi` at all rather than 0,0 — which is a real place in the Atlantic and
 * would pass a null check — so absence is the signal to skip it.
 *
 * Days are converted to 0-based here for the same reason the list does it:
 * trip-kit groups on a 0-based day, and the server numbers from 1.
 */
export function pointsFromDays(days: DayLike[]): PackPoint[] {
  const points: PackPoint[] = [];

  for (const day of days) {
    day.stops.forEach((s, i) => {
      const lat = s.poi?.latitude;
      const lon = s.poi?.longitude;
      if (typeof lat !== "number" || typeof lon !== "number") return;

      points.push({
        id: s.id || `${day.dayNumber}-${i}`,
        name: s.name ?? "",
        category: s.poi?.category ?? "",
        latitude: lat,
        longitude: lon,
        day: day.dayNumber - 1,
        seq: points.length + 1,
      });
    });
  }

  return points;
}
