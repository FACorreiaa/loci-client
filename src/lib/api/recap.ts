// Trip recaps and the year in review over RecapService. The cards stay as the generated protobuf
// messages: they are a typed oneof, and the player switches on `card.case`.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  RecapService,
  RecapImageFormat,
  GetTripRecapRequestSchema,
  GetYearInReviewRequestSchema,
  GetSharedRecapRequestSchema,
  ShareRecapRequestSchema,
  UnshareRecapRequestSchema,
  MarkRecapViewedRequestSchema,
  RenderRecapCardImageRequestSchema,
  type Recap,
  type RecapCard,
} from "@buf/loci_loci-proto.bufbuild_es/loci/recap/recap_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import { capture } from "../analytics";

export type { Recap, RecapCard };
export { RecapKind, RecapStatus } from "@buf/loci_loci-proto.bufbuild_es/loci/recap/recap_pb.js";

const recapClient = createClient(RecapService, transport);

export const recapKeys = {
  trip: (tripId: string) => ["recap", "trip", tripId] as const,
  year: (year: number) => ["recap", "year", year] as const,
  shared: (code: string) => ["recap", "shared", code] as const,
};

/** The recap of one of my trips; built on the server the first time it is asked for. */
export const useTripRecap = (tripId: () => string | undefined) =>
  useAppQuery(() => ({
    queryKey: recapKeys.trip(tripId() ?? ""),
    enabled: !!tripId(),
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await recapClient.getTripRecap(
        create(GetTripRecapRequestSchema, { tripId: tripId()! }),
      );
      return res.recap;
    },
  }));

/**
 * My year in review. Before the year opens (1 December) it comes back
 * INELIGIBLE with a reason; once open it is built the first time it is asked
 * for.
 */
export const useYearInReview = (year: () => number | undefined) =>
  useAppQuery(() => ({
    queryKey: recapKeys.year(year() ?? 0),
    enabled: !!year(),
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await recapClient.getYearInReview(
        create(GetYearInReviewRequestSchema, { year: year()! }),
      );
      return res.recap;
    },
  }));

/** A recap opened from its share link; works signed out. */
export const useSharedRecap = (code: () => string | undefined) =>
  useAppQuery(() => ({
    queryKey: recapKeys.shared(code() ?? ""),
    enabled: !!code(),
    retry: false,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await recapClient.getSharedRecap(
        create(GetSharedRecapRequestSchema, { shareCode: code()! }),
      );
      return res.recap;
    },
  }));

/** Rebuilds my recap with whatever was recorded since (only while it is unshared and new). */
export const useRefreshTripRecap = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (tripId: string) => {
      const res = await recapClient.getTripRecap(
        create(GetTripRecapRequestSchema, { tripId, refresh: true }),
      );
      return res.recap;
    },
    onSuccess: (recap, tripId) => qc.setQueryData(recapKeys.trip(tripId), recap),
  }));
};

/** Mints (or returns) the public link. Sharing freezes the recap. */
export const useShareRecap = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (vars: { recapId: string; tripId?: string; year?: number }) => {
      const res = await recapClient.shareRecap(
        create(ShareRecapRequestSchema, { recapId: vars.recapId }),
      );
      return { code: res.shareCode, url: res.shareUrl };
    },
    onSuccess: (_res, vars) => {
      capture("recap_shared", { kind: "link" });
      if (vars.tripId) void qc.invalidateQueries({ queryKey: recapKeys.trip(vars.tripId) });
      if (vars.year) void qc.invalidateQueries({ queryKey: recapKeys.year(vars.year) });
    },
  }));
};

export const useUnshareRecap = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (vars: { recapId: string; tripId?: string }) => {
      await recapClient.unshareRecap(create(UnshareRecapRequestSchema, { recapId: vars.recapId }));
    },
    onSuccess: (_res, vars) => {
      if (vars.tripId) void qc.invalidateQueries({ queryKey: recapKeys.trip(vars.tripId) });
    },
  }));
};

/** Fire-and-forget: the owner opened it, so the runner will not push it. */
export const markRecapViewed = (recapId: string) => {
  recapClient
    .markRecapViewed(create(MarkRecapViewedRequestSchema, { recapId }))
    .catch(() => undefined);
};

/** One card as a 1080x1920 PNG, drawn by the server. */
export const renderRecapCard = async (recapId: string, cardId: string): Promise<Blob> => {
  const res = await recapClient.renderRecapCardImage(
    create(RenderRecapCardImageRequestSchema, {
      recapId,
      cardId,
      format: RecapImageFormat.STORY,
    }),
  );
  return new Blob([res.png as Uint8Array<ArrayBuffer>], { type: "image/png" });
};
