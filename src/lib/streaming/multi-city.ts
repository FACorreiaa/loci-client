// src/lib/streaming/multi-city.ts
//
// A multi-city stream is the single-city stream once per city, each event
// tagged with the city's index (StreamEvent.stop_index). This is the per-city
// half of the projection: applyCityEvent is exactly what streaming-service
// does to one result, and applyStopEvent routes a tagged event to its city.
import type { LociStreamEvent, RouteInfo } from "./chatStream";
import type {
  AccommodationResponse,
  ActivitiesResponse,
  AiCityResponse,
  DiningResponse,
  HotelDetailedInfo,
  RestaurantDetailedInfo,
  UnifiedChatResponse,
} from "~/lib/api/types";

type Data = Partial<UnifiedChatResponse> | null;

/** One city of a multi-city run: what a single-city run would hold. */
export interface StopState {
  index: number;
  cityName: string;
  sessionId: string;
  /** Trip-wide day numbers spent in this city. */
  dayNumbers: number[];
  data: Data;
  /** Set when this city failed; the others go on. */
  error?: string;
  done: boolean;
}

/** One event's effect on one city's result — the single-city projection. */
export function applyCityEvent(
  data: Data,
  ev: LociStreamEvent,
  isCity: boolean,
  sessionId: string,
): Data {
  switch (ev.kind) {
    case "city_data": {
      if (!isCity || !ev.city) return data;
      return { ...data, general_city_data: ev.city, session_id: sessionId } as Data;
    }
    case "general_pois": {
      if (!isCity) return data;
      const next = { ...data, points_of_interest: ev.pois } as Partial<AiCityResponse>;
      if (ev.city) next.general_city_data = ev.city;
      return next as Data;
    }
    case "itinerary":
      // The itinerary event carries the full aggregate city response.
      return ev.cityResponse as Data;
    case "hotels":
      return {
        general_city_data: ev.city,
        // Slice 1: hotels are POI-shaped end-to-end (see chatStream.ts).
        hotels: ev.pois as unknown as HotelDetailedInfo[],
        domain: "accommodation",
        session_id: ev.sessionId || sessionId,
      } as AccommodationResponse as Data;
    case "restaurants":
      return {
        general_city_data: ev.city,
        restaurants: ev.pois as unknown as RestaurantDetailedInfo[],
        domain: "dining",
        session_id: ev.sessionId || sessionId,
      } as DiningResponse as Data;
    case "activities":
      return {
        general_city_data: ev.city,
        activities: ev.pois,
        domain: "activities",
        session_id: ev.sessionId || sessionId,
      } as ActivitiesResponse as Data;
    default:
      return data;
  }
}

/** The cities a ROUTE names; a repeated ROUTE keeps what each city already streamed. */
export function stopsFromRoute(route: RouteInfo, prev: StopState[] = []): StopState[] {
  return route.stops.map((s) => {
    const had = prev.find((p) => p.index === s.index);
    return {
      index: s.index,
      cityName: s.cityName,
      sessionId: s.sessionId,
      dayNumbers: s.dayNumbers,
      data: had?.data ?? null,
      error: had?.error,
      done: had?.done ?? false,
    };
  });
}

/** Apply a tagged event to its city. Untagged events are returned unchanged. */
export function applyStopEvent(
  stops: StopState[],
  ev: LociStreamEvent,
  isCity: boolean,
): StopState[] {
  if (ev.stopIndex === undefined) return stops;
  return stops.map((s) => {
    if (s.index !== ev.stopIndex) return s;
    if (ev.kind === "error") return { ...s, error: ev.userMessage, done: true };
    const data = applyCityEvent(s.data, ev, isCity, s.sessionId);
    const done =
      ev.kind === "itinerary" ||
      ev.kind === "hotels" ||
      ev.kind === "restaurants" ||
      ev.kind === "activities";
    return { ...s, data, done: s.done || done };
  });
}

/**
 * The run completed: a city still planning never will. It is marked failed
 * rather than left spinning — its error may have been lost with its own
 * deadline.
 */
export const finishStops = (stops: StopState[]): StopState[] =>
  stops.map((s) =>
    s.done || s.error
      ? s
      : { ...s, done: true, error: `We couldn't plan ${s.cityName} this time.` },
  );
