// Ranking API — the traveller's own ranked list of places they have been, one
// per city, built by "How was it?" and "Better or worse than Y?". Friends can
// read each other's lists; nobody else can.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import {
  RankingService,
  RatePlaceRequestSchema,
  ComparePlacesRequestSchema,
  DeleteRankingRequestSchema,
  ListMyRankingsRequestSchema,
  ListUserRankingsRequestSchema,
  Verdict,
  type RankedPlace,
  type Comparison,
} from "@buf/loci_loci-proto.bufbuild_es/loci/ranking/ranking_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import type { ComparisonView, RankedPlaceView, VerdictName } from "../ranking/flow";

const rankingClient = createClient(RankingService, transport);

export const rankingKeys = {
  all: ["rankings"] as const,
  mine: (city: string) => ["rankings", "mine", city] as const,
  user: (userId: string, city: string) => ["rankings", "user", userId, city] as const,
};

const VERDICT_NAMES: Record<number, VerdictName> = {
  [Verdict.LOVED]: "loved",
  [Verdict.FINE]: "fine",
  [Verdict.NOT_FOR_ME]: "not_for_me",
};

const VERDICT_VALUES: Record<VerdictName, Verdict> = {
  loved: Verdict.LOVED,
  fine: Verdict.FINE,
  not_for_me: Verdict.NOT_FOR_ME,
};

export const mapRankedPlace = (p: RankedPlace): RankedPlaceView => ({
  poiId: p.poiId,
  name: p.name,
  category: p.category ?? "",
  cityName: p.cityName,
  verdict: VERDICT_NAMES[p.verdict] ?? "fine",
  rank: p.rank ?? 0,
  score: p.score ?? 0,
  pending: p.pending ?? false,
  updatedAt: p.updatedAt ? timestampDate(p.updatedAt) : undefined,
});

const mapComparison = (c: Comparison | undefined): ComparisonView | undefined =>
  c ? { poiId: c.poiId, name: c.name } : undefined;

export interface RatePlaceInput {
  poiId: string;
  name: string;
  cityName: string;
  category?: string;
  verdict: VerdictName;
}

export interface RankingStep {
  place: RankedPlaceView;
  next?: ComparisonView;
}

export const useRatePlace = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: RatePlaceInput): Promise<RankingStep> => {
      const res = await rankingClient.ratePlace(
        create(RatePlaceRequestSchema, {
          poiId: input.poiId,
          poiName: input.name,
          cityName: input.cityName.trim(),
          category: (input.category ?? "").slice(0, 80),
          verdict: VERDICT_VALUES[input.verdict],
        }),
      );
      if (!res.place) throw new Error("Couldn't save that — try again.");
      return { place: mapRankedPlace(res.place), next: mapComparison(res.next) };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rankingKeys.all }),
  }));
};

export const useComparePlaces = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: {
      poiId: string;
      otherPoiId: string;
      better: boolean;
    }): Promise<RankingStep> => {
      const res = await rankingClient.comparePlaces(create(ComparePlacesRequestSchema, input));
      if (!res.place) throw new Error("Couldn't save that — try again.");
      return { place: mapRankedPlace(res.place), next: mapComparison(res.next) };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rankingKeys.all }),
  }));
};

export const useDeleteRanking = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (poiId: string) => {
      await rankingClient.deleteRanking(create(DeleteRankingRequestSchema, { poiId }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rankingKeys.all }),
  }));
};

/** The caller's ranked places; city "" lists every city. */
export const useMyRankings = (city: () => string, enabled: () => boolean = () => true) =>
  useAppQuery(() => ({
    queryKey: rankingKeys.mine(city().trim().toLowerCase()),
    queryFn: async () => {
      const res = await rankingClient.listMyRankings(
        create(ListMyRankingsRequestSchema, { cityName: city().trim() }),
      );
      return (res.places ?? []).map(mapRankedPlace);
    },
    enabled: enabled(),
    staleTime: 60 * 1000,
  }));

/** A friend's ranked places. The server refuses anyone who is not a friend. */
export const useUserRankings = (
  userId: () => string | undefined,
  enabled: () => boolean,
  city: () => string = () => "",
) =>
  useAppQuery(() => ({
    queryKey: rankingKeys.user(userId() ?? "", city().trim().toLowerCase()),
    queryFn: async () => {
      const res = await rankingClient.listUserRankings(
        create(ListUserRankingsRequestSchema, { userId: userId() ?? "", cityName: city().trim() }),
      );
      return (res.places ?? []).map(mapRankedPlace);
    },
    enabled: enabled() && !!userId(),
    staleTime: 60 * 1000,
    retry: false,
  }));
