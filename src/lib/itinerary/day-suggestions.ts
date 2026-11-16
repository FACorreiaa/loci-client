/* ============================================================
   "Also near this day": a few places a day could take.

   No model is asked. Two sources, both already there:
   - places the generation found for this city that are not on
     the trip (the "More to explore" cards), and
   - whatever Loci has stored around the day's stops.
   Food is left out; that is what "Eat nearby" on a stop is for.
   ============================================================ */

import { EAT_CATEGORIES } from "./eat-nearby";
import { distanceKm, type Coord } from "./geo";
import { normalizeName } from "./trip-view";

export { distanceKm, type Coord };

export interface SuggestionCandidate {
  id?: string;
  name: string;
  category?: string;
  rating?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface DaySuggestion extends SuggestionCandidate {
  /** Where it came from: the generation's extras, or the nearby listing. */
  source: "extras" | "nearby";
  /** Kilometres from the middle of the day's stops, when both are placed. */
  distanceKm?: number;
}

/** How far from the middle of a day a generated extra may be. */
export const EXTRAS_RADIUS_KM = 2;
/** How far the nearby listing is asked to reach. */
export const NEARBY_RADIUS_KM = 1.5;
export const DAY_SUGGESTIONS = 4;

const placed = (c: { latitude?: number; longitude?: number }): c is Coord =>
  typeof c.latitude === "number" &&
  typeof c.longitude === "number" &&
  (c.latitude !== 0 || c.longitude !== 0);

/** The middle of a day's placed stops, or undefined when none is placed. */
export function dayCentroid(stops: { latitude?: number; longitude?: number }[]): Coord | undefined {
  const at = stops.filter(placed);
  if (at.length === 0) return undefined;
  return {
    latitude: at.reduce((sum, s) => sum + s.latitude, 0) / at.length,
    longitude: at.reduce((sum, s) => sum + s.longitude, 0) / at.length,
  };
}

const isFood = (category?: string) => {
  const words = (category ?? "").toLowerCase().split(/[^\p{L}]+/u);
  return EAT_CATEGORIES.some((food) => words.includes(food) || words.includes(`${food}s`));
};

/**
 * Closer than this, two pins are one place. The same sight is stored under
 * more than one name ("Real Alcázar de Sevilla", "Real Alcázar of Seville"),
 * and a name check alone offered a stop the day already had.
 */
export const SAME_PLACE_KM = 0.075;

/**
 * Up to `n` places for one day.
 *
 * The generation's extras come first: they were picked for this traveller and
 * this city. An extra with a known position has to be near the day; one with
 * none is kept only when the day has no position either, since then there is
 * nothing to judge it by. The nearby listing fills what is left, best rated
 * then closest. Nothing already on the trip, by name or by position, no food,
 * no place twice.
 */
export function pickDaySuggestions(input: {
  centroid?: Coord;
  onTrip: string[];
  /** Where the trip's stops are, to catch a stop offered under another name. */
  onTripAt?: { latitude?: number; longitude?: number }[];
  extras: SuggestionCandidate[];
  nearby: SuggestionCandidate[];
  n?: number;
}): DaySuggestion[] {
  const n = input.n ?? DAY_SUGGESTIONS;
  const taken = new Set(input.onTrip.map(normalizeName));
  const takenAt: Coord[] = (input.onTripAt ?? []).filter(placed);
  const out: DaySuggestion[] = [];

  const consider = (c: SuggestionCandidate, source: DaySuggestion["source"], maxKm: number) => {
    const name = normalizeName(c.name);
    if (!name || taken.has(name) || isFood(c.category)) return;
    if (placed(c) && takenAt.some((at) => distanceKm(at, c) < SAME_PLACE_KM)) return;
    let km: number | undefined;
    if (input.centroid && placed(c)) {
      km = distanceKm(input.centroid, c);
      if (km > maxKm) return;
    } else if (input.centroid) {
      // The day is somewhere and this place is nowhere we know: it cannot be
      // called near.
      return;
    }
    taken.add(name);
    out.push({ ...c, source, distanceKm: km });
  };

  for (const extra of input.extras) consider(extra, "extras", EXTRAS_RADIUS_KM);
  const fromExtras = out.length;
  for (const place of input.nearby) consider(place, "nearby", NEARBY_RADIUS_KM);

  const rank = (list: DaySuggestion[]) =>
    list.sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) ||
        (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE),
    );
  return [...rank(out.slice(0, fromExtras)), ...rank(out.slice(fromExtras))].slice(0, n);
}
