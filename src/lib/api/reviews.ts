// Reviews over the ReviewService RPC, place-centric: a place's reviews and
// statistics, my review of a place, my reviews, and the writes. The requests
// and the mapping live in lib/reviews/wire.ts; these are the hooks around
// them. Mirrors loci-ios Features/Reviews/Services.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  ReviewService,
  DeleteReviewRequestSchema,
  GetReviewStatisticsRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/review/review_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import type { ReportReason } from "../reviews/model";
import {
  MINE_SCAN_MAX_PAGES,
  MINE_SCAN_PAGE_SIZE,
  MINE_PAGE_SIZE,
  POI_PAGE_SIZE,
  buildCreateRequest,
  buildLikeRequest,
  buildMyPOIReviewRequest,
  buildPOIReviewsRequest,
  buildReportRequest,
  buildUpdateRequest,
  buildUserReviewsRequest,
  canReview,
  isNotFound,
  isUnimplemented,
  pageHasMore,
  toMineSummary,
  toReview,
  toStats,
  type ReviewItem,
  type ReviewPage,
  type ReviewStats,
  type ReviewWrite,
} from "../reviews/wire";
import type { MineSummary } from "../reviews/model";

export type { ReviewItem, ReviewPage, ReviewStats, ReviewWrite } from "../reviews/wire";

const reviewClient = createClient(ReviewService, transport);

// --- fetches (plain, so "Load more" can ask for the next page) ---

export async function fetchPOIReviewsPage(poiId: string, page: number): Promise<ReviewPage> {
  const res = await reviewClient.getPOIReviews(buildPOIReviewsRequest(poiId, page));
  const reviews = res.reviews.map(toReview);
  return {
    reviews,
    page,
    hasMore: pageHasMore(res.pagination, page, POI_PAGE_SIZE, reviews.length),
    total: res.pagination?.totalRecords ?? reviews.length,
  };
}

export interface MyReviewsPage extends ReviewPage {
  /** The server's statistics over all of your reviews; undefined on servers that leave them empty. */
  summary?: MineSummary;
}

export async function fetchUserReviewsPage(page: number): Promise<MyReviewsPage> {
  const res = await reviewClient.getUserReviews(buildUserReviewsRequest(page));
  const reviews = res.reviews.map(toReview);
  return {
    reviews,
    page,
    hasMore: pageHasMore(res.pagination, page, MINE_PAGE_SIZE, reviews.length),
    total: res.pagination?.totalRecords ?? reviews.length,
    summary: toMineSummary(res.statistics),
  };
}

/**
 * Your review of a place, or null. GetMyPOIReview answers NotFound when there
 * is none. A server that predates that RPC (Unimplemented) is asked the old
 * way: your reviews, 100 at a time up to five pages, filtered here.
 */
export async function fetchMyPOIReview(poiId: string): Promise<ReviewItem | null> {
  try {
    const res = await reviewClient.getMyPOIReview(buildMyPOIReviewRequest(poiId));
    return res.review ? toReview(res.review) : null;
  } catch (error) {
    if (isNotFound(error)) return null;
    if (!isUnimplemented(error)) throw error;
  }
  for (let page = 1; page <= MINE_SCAN_MAX_PAGES; page++) {
    const res = await reviewClient.getUserReviews(
      buildUserReviewsRequest(page, MINE_SCAN_PAGE_SIZE),
    );
    const found = res.reviews.find((r) => (r.poiId || r.contentId) === poiId);
    if (found) return toReview(found);
    if (!pageHasMore(res.pagination, page, MINE_SCAN_PAGE_SIZE, res.reviews.length)) break;
  }
  return null;
}

// --- queries ---

export const reviewKeys = {
  all: ["reviews"] as const,
  poi: (poiId: string) => ["reviews", "poi", poiId] as const,
  stats: (poiId: string) => ["reviews", "stats", poiId] as const,
  mineFor: (poiId: string) => ["reviews", "mine-for", poiId] as const,
  mine: () => ["reviews", "me"] as const,
};

/** The first page of a place's reviews; later pages come from fetchPOIReviewsPage. */
export function usePOIReviews(poiId: () => string | undefined) {
  return useAppQuery(() => ({
    queryKey: reviewKeys.poi(poiId() ?? ""),
    enabled: canReview(poiId()),
    queryFn: () => fetchPOIReviewsPage(poiId()!, 1),
  }));
}

export function useReviewStatistics(poiId: () => string | undefined) {
  return useAppQuery(() => ({
    queryKey: reviewKeys.stats(poiId() ?? ""),
    enabled: canReview(poiId()),
    queryFn: async (): Promise<ReviewStats> => {
      const res = await reviewClient.getReviewStatistics(
        create(GetReviewStatisticsRequestSchema, { poiId: poiId()! }),
      );
      return toStats(res.statistics);
    },
  }));
}

/** Your review of this place, for "Write a review" vs "Edit your review". Signed in only. */
export function useMyPOIReview(poiId: () => string | undefined, signedIn: () => boolean) {
  return useAppQuery(() => ({
    queryKey: reviewKeys.mineFor(poiId() ?? ""),
    enabled: signedIn() && canReview(poiId()),
    queryFn: () => fetchMyPOIReview(poiId()!),
  }));
}

/** The first page of My reviews; later pages come from fetchUserReviewsPage. */
export function useUserReviews(signedIn: () => boolean) {
  return useAppQuery(() => ({
    queryKey: reviewKeys.mine(),
    enabled: signedIn(),
    queryFn: () => fetchUserReviewsPage(1),
  }));
}

// --- mutations ---

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: ReviewWrite & { poiId: string }): Promise<ReviewItem | null> => {
      const res = await reviewClient.createReview(buildCreateRequest(input.poiId, input));
      return res.review ? toReview(res.review) : null;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
  }));
}

export function useUpdateReview() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: ReviewWrite & { reviewId: string }): Promise<ReviewItem | null> => {
      const res = await reviewClient.updateReview(buildUpdateRequest(input.reviewId, input));
      return res.review ? toReview(res.review) : null;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
  }));
}

/**
 * Helpful: `isLike` is the new state, so false takes a vote back. Resolves to
 * the server's count. No refetch: the page settles its own count from it.
 */
export function useLikeReview() {
  return useMutation(() => ({
    mutationFn: async (args: { reviewId: string; isLike: boolean }): Promise<number> => {
      const res = await reviewClient.likeReview(buildLikeRequest(args.reviewId, args.isLike));
      return res.newHelpfulCount;
    },
  }));
}

export function useReportReview() {
  return useMutation(() => ({
    mutationFn: async (args: {
      reviewId: string;
      reason: ReportReason;
      details?: string;
    }): Promise<void> => {
      await reviewClient.reportReview(buildReportRequest(args.reviewId, args.reason, args.details));
    },
  }));
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (reviewId: string): Promise<void> => {
      await reviewClient.deleteReview(create(DeleteReviewRequestSchema, { reviewId }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
  }));
}
