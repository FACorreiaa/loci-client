// Reviews hooks using the ReviewService RPC.
import { useQuery, useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  ReviewService,
  CreateReviewRequestSchema,
  GetPOIReviewsRequestSchema,
  GetUserReviewsRequestSchema,
  GetRecentReviewsRequestSchema,
  LikeReviewRequestSchema,
  DeleteReviewRequestSchema,
  type Review as ProtoReview,
} from "@buf/loci_loci-proto.bufbuild_es/loci/review/review_pb.js";
import { PaginationRequestSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/common/common_pb.js";
import { transport } from "../connect-transport";
import { getAuthToken } from "../api";
import { useAppQuery } from "./authed-query";

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

const getCurrentUserId = (): string | null => {
  const token = getAuthToken();
  if (!token) return null;
  return parseJwt(token)?.user_id ?? null;
};

// View model used by the UI.
export interface ReviewItem {
  id: string;
  userId: string;
  poiId: string;
  rating: number;
  title: string;
  content: string;
  photos: string[];
  helpful: number;
  verified: boolean;
  visitDate?: string;
  createdAt?: string;
  // Enrichment from the server (joins): POI + reviewer display info.
  poiName: string;
  reviewerName: string;
  reviewerAvatar: string;
}

export interface CreateReviewInput {
  poiId: string;
  rating: number;
  title?: string;
  content: string;
  photoUrls?: string[];
  visitDate?: Date;
}

function tsToISO(ts?: { seconds?: bigint; nanos?: number }): string | undefined {
  if (!ts?.seconds) return undefined;
  return new Date(Number(ts.seconds) * 1000).toISOString();
}

function toReview(r: ProtoReview): ReviewItem {
  return {
    id: r.id,
    userId: r.userId,
    poiId: r.poiId,
    rating: r.rating,
    title: r.title,
    content: r.content,
    photos: r.photos ?? [],
    helpful: r.helpfulCount,
    verified: r.isVerified,
    visitDate: tsToISO(r.visitDate as any),
    createdAt: tsToISO(r.createdAt as any),
    poiName: r.contentName ?? "",
    reviewerName: r.reviewer?.displayName ?? "",
    reviewerAvatar: r.reviewer?.avatarUrl ?? "",
  };
}

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

export function useUserReviews() {
  return useAppQuery(() => ({
    queryKey: ["reviews", "me"],
    enabled: !!getCurrentUserId(),
    queryFn: async (): Promise<ReviewItem[]> => {
      const userId = getCurrentUserId();
      if (!userId) return [];
      const res = await reviewClient.getUserReviews(
        create(GetUserReviewsRequestSchema, {
          userId,
          pagination: create(PaginationRequestSchema, { page: 1, pageSize: 50 }),
        }),
      );
      return res.reviews.map(toReview);
    },
  }));
}

export function useRecentReviews() {
  return useAppQuery(() => ({
    queryKey: ["reviews", "recent"],
    queryFn: async (): Promise<ReviewItem[]> => {
      const res = await reviewClient.getRecentReviews(
        create(GetRecentReviewsRequestSchema, {
          pagination: create(PaginationRequestSchema, { page: 1, pageSize: 50 }),
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
    mutationFn: async (input: CreateReviewInput): Promise<ReviewItem | null> => {
      const res = await reviewClient.createReview(
        create(CreateReviewRequestSchema, {
          poiId: input.poiId,
          rating: input.rating,
          title: input.title ?? "",
          content: input.content,
          photoUrls: input.photoUrls ?? [],
        }),
      );
      return res.review ? toReview(res.review) : null;
    },
    onSuccess: () => {
      // Refresh every review list (POI, my-reviews, recent feed).
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  }));
}

export function useLikeReview() {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (args: { reviewId: string; isLike: boolean }): Promise<number> => {
      const userId = getCurrentUserId();
      if (!userId) throw new Error("not authenticated");
      const res = await reviewClient.likeReview(
        create(LikeReviewRequestSchema, { userId, reviewId: args.reviewId, isLike: args.isLike }),
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
      const userId = getCurrentUserId();
      if (!userId) throw new Error("not authenticated");
      await reviewClient.deleteReview(create(DeleteReviewRequestSchema, { userId, reviewId }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  }));
}
