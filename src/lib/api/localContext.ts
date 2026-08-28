// Local context (weather + alerts) for a location — Slice 4.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  LocalContextService,
  GetLocalContextRequestSchema,
  GetGoScoreRequestSchema,
  GetFxRatesRequestSchema,
  EstimateDriveCostRequestSchema,
  AlertKind,
  type GoScore,
} from "@buf/loci_loci-proto.bufbuild_es/loci/localcontext/localcontext_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const client = createClient(LocalContextService, transport);

export interface WeatherDay {
  date: string; // ISO
  highC: number;
  lowC: number;
  condition: string;
  precipProb: number;
}

export interface LocalAlert {
  kind: AlertKind;
  title: string;
  detail: string;
  date?: string;
  /**
   * How much this counts against the trip, 0..1.
   *
   * The server grades alerts rather than treating them alike — a public holiday
   * and a red-level wildfire are not the same news. Use it to rank and colour,
   * never to decide whether to show an alert at all.
   */
  severity: number;
  /** Which provider reported it: "nager", "gdacs", "usgs", "open-meteo-air". */
  source: string;
  /**
   * Set only for alerts that have a place — a wildfire, a cyclone, an
   * earthquake. Absent for anything country-scoped: a public holiday has no
   * coordinates. Only located alerts can be drawn on the map.
   */
  lat?: number;
  lon?: number;
}

/** True when this alert can be drawn as a map pin. */
export const isLocatedAlert = (a: LocalAlert): a is LocalAlert & { lat: number; lon: number } =>
  a.lat != null && a.lon != null;

export interface LocalContextData {
  weather: WeatherDay[];
  alerts: LocalAlert[];
  /** true when a placeholder forecast was used (no real weather key). */
  estimated: boolean;
}

export const useLocalContext = (
  lat: () => number | undefined,
  lon: () => number | undefined,
  days = 5,
) =>
  useAppQuery(() => ({
    queryKey: ["localContext", lat(), lon(), days],
    enabled: lat() != null && lon() != null,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<LocalContextData> => {
      const res = await client.getLocalContext(
        create(GetLocalContextRequestSchema, {
          latitude: lat()!,
          longitude: lon()!,
          days,
        }),
      );
      return {
        estimated: res.weatherIsEstimated,
        weather: res.weather.map((w) => ({
          date: w.date ? timestampDate(w.date).toISOString() : "",
          highC: w.highC,
          lowC: w.lowC,
          condition: w.condition,
          precipProb: w.precipProb,
        })),
        alerts: res.alerts.map((a) => ({
          kind: a.kind,
          title: a.title,
          detail: a.detail,
          date: a.date ? timestampDate(a.date).toISOString() : undefined,
          severity: a.severity,
          source: a.source,
          lat: a.latitude,
          lon: a.longitude,
        })),
      };
    },
  }));

/** Where the traveller is starting from, used for the travel-time factor. */
export interface GoScoreOrigin {
  lat: number;
  lon: number;
}

export interface GoScoreQuery {
  /** Destination by name (fuzzy-matched server-side) … */
  cityName?: string;
  /** … or by exact coordinates, which win when both are given. */
  lat?: number;
  lon?: number;
  origin?: GoScoreOrigin;
  /** Trip window. Server assumes a 48-hour weekend when omitted. */
  start?: Date;
  end?: Date;
}

/**
 * The "should I go this weekend?" score for one destination.
 *
 * `/compare` gets this for free on each column, so use this hook for the
 * standalone question — a single city on a trip page, a discover card, or
 * "should I go somewhere this weekend at all".
 *
 * The score arrives with its factors attached; render it with `GoScoreCard` so
 * the reasoning stays attached to the number.
 */
export const useGoScore = (query: () => GoScoreQuery | undefined) =>
  useAppQuery(() => {
    const q = query();
    const hasDestination = !!q && (!!q.cityName || (q.lat != null && q.lon != null));

    return {
      queryKey: [
        "goScore",
        q?.cityName ?? null,
        q?.lat ?? null,
        q?.lon ?? null,
        q?.origin?.lat ?? null,
        q?.origin?.lon ?? null,
        q?.start?.toISOString() ?? null,
        q?.end?.toISOString() ?? null,
      ],
      enabled: hasDestination,
      // Weather moves slowly and travel time not at all; no need to re-ask often.
      staleTime: 30 * 60 * 1000,
      queryFn: async (): Promise<{ score: GoScore; cityName: string }> => {
        const res = await client.getGoScore(
          create(GetGoScoreRequestSchema, {
            cityName: q!.cityName || undefined,
            latitude: q!.lat,
            longitude: q!.lon,
            originLat: q!.origin?.lat,
            originLon: q!.origin?.lon,
            start: q!.start ? timestampFromDate(q!.start) : undefined,
            end: q!.end ? timestampFromDate(q!.end) : undefined,
          }),
        );
        if (!res.score) throw new Error("go score missing from response");
        return { score: res.score, cityName: res.cityName };
      },
    };
  });

// --- Money -------------------------------------------------------------------

export interface FxRate {
  base: string;
  quote: string;
  rate: number;
  /** The day the rate was published, ISO. The ECB publishes once a working day,
   *  so a Friday rate read on a Sunday should be visibly a Friday rate. */
  asOf?: string;
}

export interface FxRatesData {
  rates: FxRate[];
  /** Currencies the ECB does not publish. Show "no rate available" for these
   *  rather than nothing — nothing is indistinguishable from a bug. */
  unsupported: string[];
}

/**
 * What the traveller's money is worth at a destination.
 *
 * Identify the destination however you can: coordinates are usually what a
 * client has, and the server resolves them to a country and then a currency
 * using the same geocoder it runs for alerts. An explicit ISO-3166 code or
 * explicit currencies take precedence when you have them.
 *
 * Note this deliberately does *not* take a country name. `GeneralCityData.country`
 * is LLM-generated prose ("Portugal"), and mapping that to a currency in the
 * client would duplicate a table the server already owns.
 */
export interface FxQuery {
  lat?: number;
  lon?: number;
  /** ISO-3166 alpha-2. Wins over coordinates. */
  countryCode?: string;
  /** Explicit ISO-4217 codes. Win over everything. */
  quotes?: string[];
}

export const useFxRates = (query: () => FxQuery | undefined) =>
  useAppQuery(() => {
    const q = query() ?? {};
    const hasTarget =
      !!q.countryCode || (q.quotes?.length ?? 0) > 0 || (q.lat != null && q.lon != null);
    return {
      queryKey: [
        "fxRates",
        q.countryCode ?? null,
        (q.quotes ?? []).join(","),
        q.lat ?? null,
        q.lon ?? null,
      ],
      enabled: hasTarget,
      // The ECB publishes once per working day.
      staleTime: 12 * 60 * 60 * 1000,
      queryFn: async (): Promise<FxRatesData> => {
        const res = await client.getFxRates(
          create(GetFxRatesRequestSchema, {
            countryCode: q.countryCode,
            quotes: q.quotes ?? [],
            latitude: q.lat,
            longitude: q.lon,
          }),
        );
        return {
          rates: res.rates.map((r) => ({
            base: r.base,
            quote: r.quote,
            rate: r.rate,
            asOf: r.asOf ? timestampDate(r.asOf).toISOString() : undefined,
          })),
          unsupported: res.unsupported,
        };
      },
    };
  });

export interface DriveCost {
  distanceKm: number;
  litres: number;
  cost: number;
  currency: string;
  /** What the number rests on. Always render it: a bare figure about someone's
   *  money invites either misplaced trust or dismissal. */
  assumptions: string;
}

/** Fuel cost for a driving leg. */
export const useDriveCost = (distanceKm: () => number | undefined, currency?: () => string) =>
  useAppQuery(() => {
    const km = distanceKm();
    return {
      queryKey: ["driveCost", km ?? null, currency?.() ?? null],
      enabled: km != null && km > 0,
      // Pure arithmetic over configured constants; it does not move.
      staleTime: 24 * 60 * 60 * 1000,
      queryFn: async (): Promise<DriveCost> => {
        const res = await client.estimateDriveCost(
          create(EstimateDriveCostRequestSchema, {
            distanceKm: km!,
            currency: currency?.(),
          }),
        );
        const e = res.estimate;
        if (!e) throw new Error("drive cost estimate missing from response");
        return {
          distanceKm: e.distanceKm,
          litres: e.litres,
          cost: e.cost,
          currency: e.currency,
          assumptions: e.assumptions,
        };
      },
    };
  });
