// Where the traveller is standing right now: place, weather, alerts and three
// short headline lists, from one GetHereBrief call. Only ever asked with a
// real position — never the hero's Lisbon stand-in.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import {
  LocalContextService,
  GetHereBriefRequestSchema,
  type HereBrief,
  type NewsTickerItem as NewsTickerItemMsg,
} from "@buf/loci_loci-proto.bufbuild_es/loci/localcontext/localcontext_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import type { LocalAlert, WeatherDay } from "./localContext";
import type { NewsTickerItem } from "../news/ticker";

const client = createClient(LocalContextService, transport);

export interface HereBriefData {
  place: { locality: string; region: string; countryCode: string; countryName: string };
  weather: WeatherDay[];
  estimated: boolean;
  alerts: LocalAlert[];
  local: NewsTickerItem[];
  disruption: NewsTickerItem[];
  whatsOn: NewsTickerItem[];
  stale: boolean;
}

/** ~1 km. Walking across town should not refetch. */
export const roundCoord2 = (v: number): number => Math.round(v * 100) / 100;

const toItem = (it: NewsTickerItemMsg): NewsTickerItem => ({
  id: it.id,
  title: it.title,
  url: it.url,
  source: it.source,
  publishedAt: it.publishedAt ? timestampDate(it.publishedAt).toISOString() : "",
  countryCode: it.countryCode,
});

export const toHereBrief = (res: HereBrief): HereBriefData => ({
  place: {
    locality: res.place?.locality ?? "",
    region: res.place?.region ?? "",
    countryCode: res.place?.countryCode ?? "",
    countryName: res.place?.countryName ?? "",
  },
  weather: res.weather.map((w) => ({
    date: w.date ? timestampDate(w.date).toISOString() : "",
    highC: w.highC,
    lowC: w.lowC,
    condition: w.condition,
    precipProb: w.precipProb,
  })),
  estimated: res.weatherIsEstimated,
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
  local: res.local.map(toItem),
  disruption: res.disruption.map(toItem),
  whatsOn: res.whatsOn.map(toItem),
  stale: res.stale,
});

export const hasAnything = (d: HereBriefData): boolean =>
  d.weather.length + d.alerts.length + d.local.length + d.disruption.length + d.whatsOn.length > 0;

export const placeLabel = (d: HereBriefData | undefined): string =>
  d?.place.locality || d?.place.region || "";

export const useHereBrief = (lat: () => number | undefined, lon: () => number | undefined) =>
  useAppQuery(() => {
    const la = lat();
    const lo = lon();
    const rla = la == null ? undefined : roundCoord2(la);
    const rlo = lo == null ? undefined : roundCoord2(lo);
    return {
      queryKey: ["hereBrief", rla ?? null, rlo ?? null],
      enabled: rla != null && rlo != null,
      staleTime: 15 * 60 * 1000,
      queryFn: async (): Promise<HereBriefData> =>
        toHereBrief(
          await client.getHereBrief(
            create(GetHereBriefRequestSchema, { latitude: rla!, longitude: rlo! }),
          ),
        ),
    };
  });
