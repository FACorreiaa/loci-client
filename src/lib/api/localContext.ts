// Local context (weather + alerts) for a location — Slice 4.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  LocalContextService,
  GetLocalContextRequestSchema,
  GetGoScoreRequestSchema,
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
}

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
