/* ============================================================
   "Eat nearby": places to eat within a short walk of one stop.

   The list is whatever Loci already has stored around the stop.
   Nothing is generated for it, so it can be short, and it can be
   empty. It says so, and always offers Google's own list beside
   it, because Loci's places are not checked against the world.
   ============================================================ */

import { normalizeName } from "./trip-view";

/**
 * The words that mark a kind of place as somewhere to eat or drink. Kinds are
 * free text ("Tapas Bar", "Historic Café"), so the server matches these as
 * whole words inside the kind, not as the whole kind.
 */
export const EAT_CATEGORIES = [
  "restaurant",
  "cafe",
  "café",
  "coffee",
  "bar",
  "bakery",
  "food",
  "pub",
  "bistro",
  "tapas",
  "tavern",
  "taverna",
  "bodega",
  "brasserie",
  "trattoria",
  "pizzeria",
  "eatery",
  "diner",
  "brewery",
];

/** How far "nearby" reaches: about a ten-minute walk. */
export const EAT_RADIUS_KM = 0.8;
export const EAT_MAX_RESULTS = 8;
/** Below this many places the list admits it is thin. */
export const EAT_FEW = 3;

const WALK_METRES_PER_MINUTE = 80;

export interface NearbyPlace {
  id: string;
  name: string;
  category?: string;
  address?: string;
  rating?: number;
  latitude?: number;
  longitude?: number;
  /** Kilometres from the anchor stop. */
  distanceKm?: number;
  description?: string;
}

export interface EatOption extends NearbyPlace {
  /** Walking time from the stop, in whole minutes, at least one. */
  walkMinutes?: number;
}

export const walkMinutes = (km: number | undefined) =>
  typeof km === "number" && km >= 0
    ? Math.max(1, Math.round((km * 1000) / WALK_METRES_PER_MINUTE))
    : undefined;

/**
 * The places worth offering: not the anchor itself, not anything already on
 * the trip (by id or by name), nearest first, capped.
 */
export function filterEatNearby(
  places: NearbyPlace[],
  onTrip: { poiId?: string; name: string }[],
  max = EAT_MAX_RESULTS,
): EatOption[] {
  const ids = new Set(onTrip.map((s) => (s.poiId ?? "").toLowerCase()).filter(Boolean));
  const names = new Set(onTrip.map((s) => normalizeName(s.name)).filter(Boolean));
  const seen = new Set<string>();
  const out: EatOption[] = [];
  const byDistance = [...places].sort(
    (a, b) => (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE),
  );
  for (const place of byDistance) {
    const name = normalizeName(place.name);
    if (!name || seen.has(name)) continue;
    if (names.has(name) || ids.has(place.id.toLowerCase())) continue;
    seen.add(name);
    out.push({ ...place, walkMinutes: walkMinutes(place.distanceKm) });
    if (out.length >= max) break;
  }
  return out;
}

/** What the panel says about how much it found. Never claims more than it has. */
export function eatNearbySummary(count: number, stopName: string): string {
  if (count === 0)
    return `Loci doesn't know anywhere to eat within a 10-minute walk of ${stopName} yet.`;
  if (count < EAT_FEW) {
    return `Loci only knows ${count} ${count === 1 ? "place" : "places"} to eat within a 10-minute walk of ${stopName}.`;
  }
  return `Places Loci knows within a 10-minute walk of ${stopName}.`;
}

/**
 * Google's list of restaurants around a stop. By name and city rather than by
 * coordinates, so it works for a stop with no known position too.
 */
export function eatNearbyGoogleUrl(stopName: string, city?: string): string {
  const where = [stopName.trim(), city?.trim()].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`restaurants near ${where}`)}`;
}
