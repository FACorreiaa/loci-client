// Travel history API — where the user has actually been.
//
// Backs the globe dashboard. Every number here is a real row in
// user_visited_cities with recorded provenance; nothing is derived from a
// counter or inferred from a plan. Two fabricated stats used to stand in for
// this data (statistics' visited_cities_count and users.places_visited) and
// both have been removed server-side.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  TravelHistoryService,
  GetGlobeDataRequestSchema,
  GetTravelSummaryRequestSchema,
  ListVisitedCitiesRequestSchema,
  VisitSource,
} from "@buf/loci_loci-proto.bufbuild_es/loci/travelhistory/travelhistory_pb.js";
import { transport } from "../connect-transport";
import { queryKeys } from "./shared";
import { useAppQuery } from "./authed-query";

const historyClient = createClient(TravelHistoryService, transport);

/** How a visit came to be known. Mirrors the proto enum. */
export type VisitSourceName = "trip" | "visit_event" | "manual" | "backfill" | "unknown";

export interface VisitedCity {
  id: string;
  cityId?: string;
  cityName: string;
  /** Empty when unresolved. Never inferred from coordinates — render "—". */
  country: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  source: VisitSourceName;
  tripId?: string;
  firstVisitAt?: Date;
  lastVisitAt?: Date;
  visitCount: number;
}

/** One leg between two placed points, ready to draw as a great circle. */
export interface GlobeArc {
  fromName: string;
  toName: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  distanceKm: number;
  tripId?: string;
  /** "fly" | "drive" | "rail" | ... Empty when the trip recorded none. */
  mode: string;
  occurredAt?: Date;
}

export interface TravelSummary {
  citiesVisited: number;
  countriesVisited: number;
  poisVisited: number;
  distanceKm: number;
  tripsCompleted: number;
  firstVisitAt?: Date;
  lastVisitAt?: Date;
  /**
   * The same counts one period earlier. These exist so the stats rail can show
   * a real delta; without them a trend arrow could only be invented, which is
   * exactly what this domain replaced.
   */
  citiesVisitedPrev: number;
  countriesVisitedPrev: number;
  poisVisitedPrev: number;
  periodDays: number;
}

export interface GlobeData {
  cities: VisitedCity[];
  arcs: GlobeArc[];
  summary: TravelSummary;
  /**
   * True once the server has derived history from pre-existing signals.
   * Distinguishes "you have been nowhere yet" from "we have not looked",
   * which the empty state renders differently.
   */
  backfilled: boolean;
}

const SOURCE_NAMES: Record<number, VisitSourceName> = {
  [VisitSource.TRIP]: "trip",
  [VisitSource.VISIT_EVENT]: "visit_event",
  [VisitSource.MANUAL]: "manual",
  [VisitSource.BACKFILL]: "backfill",
};

const sourceName = (s: number): VisitSourceName => SOURCE_NAMES[s] ?? "unknown";

/** Protobuf Timestamps arrive as {seconds: bigint, nanos: number}. */
const toDate = (ts?: { seconds: bigint; nanos: number }): Date | undefined =>
  ts ? new Date(Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1e6)) : undefined;

// Explicit `?? ""` / `?? 0` rather than a spread: proto3 omits zero values on
// the wire, and a missing count should read as 0, not undefined.
const mapCity = (c: any): VisitedCity => ({
  id: c.id ?? "",
  cityId: c.cityId || undefined,
  cityName: c.cityName ?? "",
  country: c.country ?? "",
  countryCode: c.countryCode || undefined,
  latitude: c.latitude ?? 0,
  longitude: c.longitude ?? 0,
  source: sourceName(c.source ?? 0),
  tripId: c.tripId || undefined,
  firstVisitAt: toDate(c.firstVisitAt),
  lastVisitAt: toDate(c.lastVisitAt),
  visitCount: c.visitCount ?? 0,
});

const mapArc = (a: any): GlobeArc => ({
  fromName: a.fromName ?? "",
  toName: a.toName ?? "",
  fromLat: a.fromLat ?? 0,
  fromLon: a.fromLon ?? 0,
  toLat: a.toLat ?? 0,
  toLon: a.toLon ?? 0,
  distanceKm: a.distanceKm ?? 0,
  tripId: a.tripId || undefined,
  mode: a.mode ?? "",
  occurredAt: toDate(a.occurredAt),
});

const EMPTY_SUMMARY: TravelSummary = {
  citiesVisited: 0,
  countriesVisited: 0,
  poisVisited: 0,
  distanceKm: 0,
  tripsCompleted: 0,
  citiesVisitedPrev: 0,
  countriesVisitedPrev: 0,
  poisVisitedPrev: 0,
  periodDays: 365,
};

const mapSummary = (s: any): TravelSummary =>
  s
    ? {
        citiesVisited: s.citiesVisited ?? 0,
        countriesVisited: s.countriesVisited ?? 0,
        poisVisited: s.poisVisited ?? 0,
        distanceKm: s.distanceKm ?? 0,
        tripsCompleted: s.tripsCompleted ?? 0,
        firstVisitAt: toDate(s.firstVisitAt),
        lastVisitAt: toDate(s.lastVisitAt),
        citiesVisitedPrev: s.citiesVisitedPrevPeriod ?? 0,
        countriesVisitedPrev: s.countriesVisitedPrevPeriod ?? 0,
        poisVisitedPrev: s.poisVisitedPrevPeriod ?? 0,
        periodDays: s.periodDays ?? 365,
      }
    : { ...EMPTY_SUMMARY };

export const DEFAULT_GLOBE_LIMIT = 500;
export const DEFAULT_PERIOD_DAYS = 365;

export const getGlobeData = async (
  limit = DEFAULT_GLOBE_LIMIT,
  periodDays = DEFAULT_PERIOD_DAYS,
): Promise<GlobeData> => {
  const response = await historyClient.getGlobeData(
    create(GetGlobeDataRequestSchema, { limit, periodDays }),
  );
  return {
    cities: (response.cities ?? []).map(mapCity),
    arcs: (response.arcs ?? []).map(mapArc),
    summary: mapSummary(response.summary),
    backfilled: response.backfilled ?? false,
  };
};

/**
 * Everything the globe dashboard renders, in one round trip.
 *
 * Goes through useAppQuery, not useQuery: on the server that swaps in a null
 * placeholder so no request is issued during SSR. Bypassing it is what once
 * hung the Cloudflare Worker (see authed-query.ts).
 */
export const useGlobeData = (limit = DEFAULT_GLOBE_LIMIT, periodDays = DEFAULT_PERIOD_DAYS) =>
  useAppQuery(() => ({
    queryKey: queryKeys.globeData(limit, periodDays),
    queryFn: () => getGlobeData(limit, periodDays),
    // History changes when a trip completes, not minute to minute.
    staleTime: 5 * 60 * 1000,
    retry: 2,
  }));

export const useTravelSummary = (periodDays = DEFAULT_PERIOD_DAYS) =>
  useAppQuery(() => ({
    queryKey: queryKeys.travelSummary(periodDays),
    queryFn: async () => {
      const response = await historyClient.getTravelSummary(
        create(GetTravelSummaryRequestSchema, { periodDays }),
      );
      return mapSummary(response.summary);
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  }));

export const useVisitedCities = (page = 1, pageSize = 50) =>
  useAppQuery(() => ({
    queryKey: queryKeys.visitedCities(page),
    queryFn: async () => {
      const response = await historyClient.listVisitedCities(
        create(ListVisitedCitiesRequestSchema, { page, pageSize }),
      );
      return {
        cities: (response.cities ?? []).map(mapCity),
        total: response.total ?? 0,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  }));

/**
 * Real period-over-period delta, or null when there is no prior period to
 * compare against.
 *
 * Returns null rather than 0 or 100% for a first period deliberately: an arrow
 * next to a number the user has no baseline for is decoration, and the stats
 * rail renders nothing instead.
 */
export const trendPercent = (current: number, previous: number): number | null => {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
};
