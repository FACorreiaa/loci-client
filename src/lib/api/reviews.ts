// Reviews over the ReviewService RPC, place-centric: a place's reviews and
// statistics, my reviews, and the four writes. The caller is the token, so no
// request carries a user id (every review request's user_id is optional and
// the handler reads the caller). Mirrors loci-ios Features/Reviews/Services.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  ReviewService,
  CreateReviewRequestSchema,
  GetPOIReviewsRequestSchema,
  GetUserReviewsRequestSchema,
  GetReviewStatisticsRequestSchema,
  UpdateReviewRequestSchema,
  LikeReviewRequestSchema,
  DeleteReviewRequestSchema,
  type Review as ProtoReview,
  type ReviewStatistics as ProtoStatistics,
} from "@buf/loci_loci-proto.bufbuild_es/loci/review/review_pb.js";
import { PaginationRequestSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/common/common_pb.js";
import { transport } from "../connect-transport";
import { getAuthToken } from "../api";
import { useAppQuery } from "./authed-query";
import { clampRating } from "../reviews/model";

const reviewClient = createClient(ReviewService, transport);

const parseJwt = (token: string): { user_id?: string } | null => {
  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return null;
    return JSON.parse(atob(payloadBase64));
  } catch {
    return null;
  }
};

/** The signed-in user's id, for "is this review mine"; never sent to the server. */
export const currentUserId = (): string | null => {
  const token = getAuthToken();
  if (!token) return null;
  return parseJwt(token)?.user_id ?? null;
};

// View model used by the UI.
export interface ReviewItem {
  id: string;
  userId: string;
  poiId: string;
  /** Whole stars 1–5 (the server stores a double). */
  rating: number;
  title: string;
  content: string;
  photos: string[];
  helpful: number;
  verified: boolean;
  visitDate?: string;
  createdAt?: string;
  poiName: string;
  reviewerName: string;
  reviewerAvatar: string;
}

export interface ReviewStats {
  average: number;
  total: number;
  /** Index 1–5 → count. */
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ReviewWrite {
  rating: number;
  title: string;
  content: string;
  /** ISO date (yyyy-mm-dd) or empty. On edit, empty clears it: the handler overwrites every field. */
  visitDate: string;
}

function tsToISO(ts?: { seconds?: bigint; nanos?: number }): string | undefined {
  if (!ts?.seconds) return undefined;
  return new Date(Number(ts.seconds) * 1000).toISOString();
}

export function toReview(r: ProtoReview): ReviewItem {
  return {
    id: r.id,
    userId: r.userId,
    poiId: r.poiId,
    rating: clampRating(r.rating),
    title: r.title,
    content: r.content,
    photos: r.photos ?? [],
    helpful: r.helpfulCount,
    verified: r.isVerified,
    visitDate: tsToISO(r.visitDate as { seconds?: bigint } | undefined),
    createdAt: tsToISO(r.createdAt as { seconds?: bigint } | undefined),
    poiName: r.contentName ?? "",
    reviewerName: r.reviewer?.displayName ?? "",
    reviewerAvatar: r.reviewer?.avatarUrl ?? "",
  };
}

export function toStats(s: ProtoStatistics | undefined): ReviewStats {
  const b = s?.ratingBreakdown;
  return {
    average: s?.overallRating ?? 0,
    total: s?.totalReviews ?? 0,
    breakdown: {
      1: b?.oneStar ?? 0,
      2: b?.twoStar ?? 0,
      3: b?.threeStar ?? 0,
      4: b?.fourStar ?? 0,
      5: b?.fiveStar ?? 0,
    },
  };
}

/** The review the signed-in user wrote for a place, if any, found among their own rows. */
export const myReviewFor = (
  mine: readonly ReviewItem[] | undefined,
  poiId: string,
): ReviewItem | undefined => mine?.find((r) => r.poiId === poiId);

const visitTimestamp = (iso: string) => {
  const trimmed = iso.trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : timestampFromDate(date);
};

// --- queries ---

export function usePOIReviews(poiId: () => string | undefined) {
  return useAppQuery(() => ({
    queryKey: ["reviews", "poi", poiId()],
    enabled: !!poiId(),
    queryFn: async (): Promise<ReviewItem[]> => {
      const res = await reviewClient.getPOIReviews(
        create(GetPOIReviewsRequestSchema, {
          poiId: poiId()!,
          pagination: create(PaginationRequestSchema, { page: 1, pageSize: 50 }),
        }),
      );
      return res.reviews.map(toReview);
    },
  }));
}

export function useReviewStatistics(poiId: () => string | undefined) {
  return useAppQuery(() => ({
    queryKey: ["reviews", "stats", poiId()],
    enabled: !!poiId(),
    queryFn: async (): Promise<ReviewStats> => {
      const res = await reviewClient.getReviewStatistics(
        create(GetReviewStatisticsRequestSchema, { poiId: poiId()! }),
      );
      return toStats(res.statistics);
    },
  }));
}

/** My reviews: no user id on the wire, the handler reads the caller. */
export function useUserReviews() {
  return useAppQuery(() => ({
    queryKey: ["reviews", "me"],
    enabled: !!currentUserId(),
    queryFn: async (): Promise<ReviewItem[]> => {
      const res = await reviewClient.getUserReviews(
        create(GetUserReviewsRequestSchema, {
          pagination: create(PaginationRequestSchema, { page: 1, pageSize: 100 }),
        }),
      );
      return res.reviews.map(toReview);
    },
  }));
}

// --- mutations ---

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: ReviewWrite & { poiId: string }): Promise<ReviewItem | null> => {
      // An empty poi id used to go out and be refused; it never names a place.
      if (!input.poiId) throw new Error("This review has no place to belong to.");
      const res = await reviewClient.createReview(
        create(CreateReviewRequestSchema, {
          poiId: input.poiId,
          rating: input.rating,
          title: input.title.trim(),
          content: input.content.trim(),
          visitDate: visitTimestamp(input.visitDate),
        }),
      );
      return res.review ? toReview(res.review) : null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  }));
}

export function useUpdateReview() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: ReviewWrite & { reviewId: string }): Promise<ReviewItem | null> => {
      const res = await reviewClient.updateReview(
        create(UpdateReviewRequestSchema, {
          reviewId: input.reviewId,
          rating: input.rating,
          title: input.title.trim(),
          content: input.content.trim(),
          visitDate: visitTimestamp(input.visitDate),
        }),
      );
      return res.review ? toReview(res.review) : null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  }));
}

/** Helpful: `isLike` is the new state, so false takes a vote back. */
export function useLikeReview() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (args: { reviewId: string; isLike: boolean }): Promise<number> => {
      const res = await reviewClient.likeReview(
        create(LikeReviewRequestSchema, { reviewId: args.reviewId, isLike: args.isLike }),
      );
      return res.newHelpfulCount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  }));
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (reviewId: string): Promise<void> => {
      await reviewClient.deleteReview(create(DeleteReviewRequestSchema, { reviewId }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  }));
}
