// The desk's breaking-news band: headlines for the traveller's home country,
// next destination and recent visits, selected server-side from the cluster's
// shared feed aggregator. Headline, source, time, link — never a body.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import {
  LocalContextService,
  GetNewsTickerRequestSchema,
  SetNewsTickerEnabledRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/localcontext/localcontext_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import { loadSnapshot, saveSnapshot, type NewsTickerData } from "../news/ticker";

const client = createClient(LocalContextService, transport);

export const newsTickerKey = ["newsTicker"] as const;

const REFRESH_MS = 5 * 60 * 1000;

const storage = () => (typeof window === "undefined" ? undefined : window.localStorage);

export const fetchNewsTicker = async (limit = 20): Promise<NewsTickerData> => {
  const res = await client.getNewsTicker(create(GetNewsTickerRequestSchema, { limit }));
  const data: NewsTickerData = {
    enabled: res.enabled,
    stale: res.stale,
    countryCodes: res.countryCodes,
    items: res.items.map((it) => ({
      id: it.id,
      title: it.title,
      url: it.url,
      source: it.source,
      publishedAt: it.publishedAt ? timestampDate(it.publishedAt).toISOString() : "",
      countryCode: it.countryCode,
    })),
  };
  saveSnapshot(storage(), data, new Date());
  return data;
};

/**
 * Refreshes on focus and every five minutes while the tab is visible. The
 * last snapshot the browser saw is the placeholder, so the band paints
 * instantly and keeps showing something offline.
 */
export const useNewsTicker = () =>
  useAppQuery(() => ({
    queryKey: newsTickerKey,
    queryFn: () => fetchNewsTicker(),
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    placeholderData: () => loadSnapshot(storage())?.data,
  }));

export const useSetNewsTickerEnabled = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (enabled: boolean) => {
      const res = await client.setNewsTickerEnabled(create(SetNewsTickerEnabledRequestSchema, { enabled }));
      return res.enabled;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: newsTickerKey });
    },
  }));
};
