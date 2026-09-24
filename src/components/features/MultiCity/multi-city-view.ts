// Pure helpers for showing a multi-city trip. iOS renders the same strings
// (MultiCityFormat.swift), so both apps read alike.
import type { RouteLeg } from "~/lib/streaming/chatStream";
import type { StopState } from "~/lib/streaming/multi-city";
import type { POIDetailedInfo } from "~/lib/api/types";

export type StopInput = { cityName: string; nights?: number };

export type TimelineItem =
  | { kind: "day"; day: number; cityName: string; stopIndex: number; pois: POIDetailedInfo[] }
  | { kind: "leg"; leg: RouteLeg };

/** The most cities one trip plans — the server's cap, repeated so the UI can say so. */
export const MAX_STOPS = 5;

/** `Lisbon:3,Porto:2,Seville` → stops; unknown nights stay undefined. */
export function parseStopsParam(raw: string | undefined): StopInput[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => {
      const [name, n] = part.split(":");
      const nights = n ? Number.parseInt(n, 10) : Number.NaN;
      return {
        cityName: decodeURIComponent(name ?? "").trim(),
        nights: Number.isFinite(nights) && nights > 0 ? nights : undefined,
      };
    })
    .filter((s) => s.cityName)
    .slice(0, MAX_STOPS);
}

export const formatStopsParam = (stops: StopInput[]): string =>
  stops.map((s) => (s.nights ? `${s.cityName}:${s.nights}` : s.cityName)).join(",");

export const stopChipLabel = (s: StopState): string => `${s.cityName} · ${s.dayNumbers.length}n`;

const MODE_LABEL: Record<string, string> = {
  drive: "Drive",
  train: "Train",
  bus: "Bus",
  flight: "Flight",
};

const hm = (mins: number) =>
  mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;

/** "Train · ≈3h14 · 274 km" — an estimate, and it says so. */
export const formatLeg = (leg: RouteLeg): string =>
  `${MODE_LABEL[leg.mode] ?? "Travel"} · ≈${hm(leg.durationMins)} · ${Math.round(leg.distanceKm)} km`;

/** A city's itinerary places, whichever list the result carries them in. */
export const stopPlaces = (stop: StopState): POIDetailedInfo[] => {
  const d = stop.data as {
    itinerary_response?: { points_of_interest?: POIDetailedInfo[] };
    points_of_interest?: POIDetailedInfo[];
  } | null;
  const planned = d?.itinerary_response?.points_of_interest;
  return planned && planned.length > 0 ? planned : (d?.points_of_interest ?? []);
};

/** Every day of the trip, across cities, with the move between cities where it happens. */
export function allDaysTimeline(stops: StopState[], legs: RouteLeg[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const stop of stops) {
    const pois = stopPlaces(stop);
    stop.dayNumbers.forEach((day, k) => {
      items.push({
        kind: "day",
        day,
        cityName: stop.cityName,
        stopIndex: stop.index,
        pois: pois.filter((p) => ((p as { day?: number }).day ?? 1) === k + 1),
      });
      const leg = legs.find((l) => l.afterDay === day && l.fromName === stop.cityName);
      if (leg) items.push({ kind: "leg", leg });
    });
  }
  return items;
}

type CityData = {
  general_city_data?: unknown;
  itinerary_response?: { points_of_interest?: POIDetailedInfo[]; [k: string]: unknown };
  points_of_interest?: POIDetailedInfo[];
  [k: string]: unknown;
};

const withTripDays = (
  pois: POIDetailedInfo[] | undefined,
  dayNumbers: number[],
): POIDetailedInfo[] =>
  (pois ?? []).map((p) => {
    const local = (p as { day?: number }).day ?? 1;
    return {
      ...p,
      day: dayNumbers[local - 1] ?? dayNumbers[dayNumbers.length - 1] ?? local,
    } as POIDetailedInfo;
  });

/** One city's result with its days numbered across the whole trip. */
export function tripWideResponse(stop: StopState): CityData | null {
  const d = stop.data as CityData | null;
  if (!d) return null;
  return {
    ...d,
    points_of_interest: withTripDays(d.points_of_interest, stop.dayNumbers),
    itinerary_response: d.itinerary_response
      ? {
          ...d.itinerary_response,
          points_of_interest: withTripDays(
            d.itinerary_response.points_of_interest,
            stop.dayNumbers,
          ),
        }
      : undefined,
  };
}

/** Every city in one response, days numbered across the trip — what the map draws. */
export function mergedResponse(stops: StopState[]): CityData | null {
  const parts = stops.map(tripWideResponse).filter((d): d is CityData => d !== null);
  if (parts.length === 0) return null;
  return {
    ...parts[0],
    points_of_interest: parts.flatMap((d) => d.points_of_interest ?? []),
    itinerary_response: {
      ...parts[0].itinerary_response,
      points_of_interest: parts.flatMap((d) => d.itinerary_response?.points_of_interest ?? []),
    },
  };
}

/** A map camera that shows every point: their midpoint, zoomed out to the span. */
export function mapView(points: { latitude: number; longitude: number }[]): {
  center: [number, number];
  zoom: number;
} {
  const pts = points.filter(
    (p) =>
      Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && (p.latitude || p.longitude),
  );
  if (pts.length === 0) return { center: [0, 0], zoom: 12 };
  const lats = pts.map((p) => p.latitude);
  const lons = pts.map((p) => p.longitude);
  const [minLat, maxLat, minLon, maxLon] = [
    Math.min(...lats),
    Math.max(...lats),
    Math.min(...lons),
    Math.max(...lons),
  ];
  const span = Math.max(maxLat - minLat, maxLon - minLon);
  const zoom = span < 0.2 ? 12 : span < 1 ? 9 : span < 3 ? 7 : span < 8 ? 5 : 4;
  return { center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2], zoom };
}
