// Reviews on the wire: the view models, the proto → view mapping, and every
// request the page sends. Pure (no transport), so it tests on its own; the
// hooks in lib/api/reviews.ts only call these.
//
// No request carries a user id. Every review request's user_id is optional
// and the handler reads the caller from the token.
import { create } from "@bufbuild/protobuf";
import { timestampFromDate, type Timestamp } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  CreateReviewRequestSchema,
  GetMyPOIReviewRequestSchema,
  GetPOIReviewsRequestSchema,
  GetUserReviewsRequestSchema,
  LikeReviewRequestSchema,
  ReportReviewRequestSchema,
  UpdateReviewRequestSchema,
  type CreateReviewRequest,
  type GetMyPOIReviewRequest,
  type GetPOIReviewsRequest,
  type GetUserReviewsRequest,
  type LikeReviewRequest,
  type ReportReviewRequest,
  type Review as ProtoReview,
  type ReviewStatistics as ProtoStatistics,
  type UpdateReviewRequest,
  type UserReviewStatistics as ProtoUserStatistics,
} from "@buf/loci_loci-proto.bufbuild_es/loci/review/review_pb.js";
import { PaginationRequestSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/common/common_pb.js";
import { isOpenableId } from "../saved/collect";
import {
  REPORT_DETAILS_MAX,
  clampRating,
  isReportReason,
  visitDayToDate,
  type MineSummary,
  type ReportReason,
  type StarBreakdown,
} from "./model";

/** A review as the UI reads it. */
export interface ReviewItem {
  id: string;
  userId: string;
  poiId: string;
  /** Whole stars 1–5 (the server stores a double). */
  rating: number;
  title: string;
  content: string;
  helpful: number;
  /** The caller has marked it helpful (the server's `voted_by_me`). */
  votedByMe: boolean;
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
  breakdown: StarBreakdown;
}

export interface ReviewWrite {
  rating: number;
  title: string;
  content: string;
  /** The visit day (yyyy-mm-dd) or "". On edit, "" clears it: the handler overwrites every field. */
  visitDate: string;
}

/** One page of a list and whether another follows. */
export interface ReviewPage {
  reviews: ReviewItem[];
  page: number;
  hasMore: boolean;
  total: number;
}

export const POI_PAGE_SIZE = 20;
export const MINE_PAGE_SIZE = 20;
/** The older servers' "my review of this place" fallback: pages of 100, at most five. */
export const MINE_SCAN_PAGE_SIZE = 100;
export const MINE_SCAN_MAX_PAGES = 5;

const tsToISO = (ts?: Timestamp): string | undefined =>
  ts && (ts.seconds || ts.nanos) ? new Date(Number(ts.seconds) * 1000).toISOString() : undefined;

export function toReview(r: ProtoReview): ReviewItem {
  return {
    id: r.id,
    userId: r.userId,
    poiId: r.poiId || r.contentId,
    rating: clampRating(r.rating),
    title: r.title,
    content: r.content,
    helpful: Math.max(0, r.helpfulCount),
    votedByMe: r.votedByMe ?? false,
    verified: r.isVerified,
    visitDate: tsToISO(r.visitDate),
    createdAt: tsToISO(r.createdAt),
    poiName: r.contentName ?? "",
    reviewerName: r.reviewer?.displayName ?? "",
    reviewerAvatar: r.reviewer?.avatarUrl ?? "",
  };
}

const toBreakdown = (b?: {
  oneStar: number;
  twoStar: number;
  threeStar: number;
  fourStar: number;
  fiveStar: number;
}): StarBreakdown => ({
  1: b?.oneStar ?? 0,
  2: b?.twoStar ?? 0,
  3: b?.threeStar ?? 0,
  4: b?.fourStar ?? 0,
  5: b?.fiveStar ?? 0,
});

export function toStats(s: ProtoStatistics | undefined): ReviewStats {
  return {
    average: s?.overallRating ?? 0,
    total: s?.totalReviews ?? 0,
    breakdown: toBreakdown(s?.ratingBreakdown),
  };
}

/** The server's UserReviewStatistics, or undefined when it sent none (older servers). */
export function toMineSummary(s: ProtoUserStatistics | undefined): MineSummary | undefined {
  if (!s || s.totalReviews <= 0) return undefined;
  return {
    count: s.totalReviews,
    averageGiven: s.averageRatingGiven,
    helpfulReceived: s.helpfulVotesReceived,
    distribution: toBreakdown(s.ratingDistribution),
  };
}

/** Whether a page is followed by another, from the metadata or, without it, from a full page. */
export function pageHasMore(
  meta: { totalRecords: number; page: number; pageSize: number } | undefined,
  page: number,
  pageSize: number,
  received: number,
): boolean {
  if (meta && meta.totalRecords > 0) return page * pageSize < meta.totalRecords;
  return received >= pageSize;
}

// --- requests ---

/** Only a stored place (a UUID) has reviews: the handler parses poi_id as one. */
export const canReview = (poiId: string | undefined): poiId is string =>
  !!poiId && isOpenableId(poiId);

const requirePoi = (poiId: string): string => {
  if (!canReview(poiId)) throw new Error("This place can't be reviewed yet.");
  return poiId.trim();
};

const pagination = (page: number, pageSize: number) =>
  create(PaginationRequestSchema, { page: Math.max(1, Math.floor(page)), pageSize });

const visitTimestamp = (day: string) => {
  const date = visitDayToDate(day);
  return date ? timestampFromDate(date) : undefined;
};

export function buildPOIReviewsRequest(poiId: string, page: number): GetPOIReviewsRequest {
  return create(GetPOIReviewsRequestSchema, {
    poiId: requirePoi(poiId),
    pagination: pagination(page, POI_PAGE_SIZE),
  });
}

export function buildMyPOIReviewRequest(poiId: string): GetMyPOIReviewRequest {
  return create(GetMyPOIReviewRequestSchema, { poiId: requirePoi(poiId) });
}

/** My reviews: no user id, which the handler reads as the caller. */
export function buildUserReviewsRequest(
  page: number,
  pageSize = MINE_PAGE_SIZE,
): GetUserReviewsRequest {
  return create(GetUserReviewsRequestSchema, { pagination: pagination(page, pageSize) });
}

/** Whole stars, trimmed text, the visit day at noon UTC when one is set; no photos. */
export function buildCreateRequest(poiId: string, input: ReviewWrite): CreateReviewRequest {
  return create(CreateReviewRequestSchema, {
    poiId: requirePoi(poiId),
    rating: clampRating(input.rating),
    title: input.title.trim(),
    content: input.content.trim(),
    visitDate: visitTimestamp(input.visitDate),
  });
}

/** The whole review: the handler overwrites every field, so no visit day clears it. */
export function buildUpdateRequest(reviewId: string, input: ReviewWrite): UpdateReviewRequest {
  return create(UpdateReviewRequestSchema, {
    reviewId,
    rating: clampRating(input.rating),
    title: input.title.trim(),
    content: input.content.trim(),
    visitDate: visitTimestamp(input.visitDate),
  });
}

/** `isLike` is the new state: false takes the vote back. */
export function buildLikeRequest(reviewId: string, isLike: boolean): LikeReviewRequest {
  return create(LikeReviewRequestSchema, { reviewId, isLike });
}

export function buildReportRequest(
  reviewId: string,
  reason: ReportReason,
  details = "",
): ReportReviewRequest {
  if (!isReportReason(reason)) throw new Error("Pick a reason for the report.");
  return create(ReportReviewRequestSchema, {
    reviewId,
    reason,
    details: details.trim().slice(0, REPORT_DETAILS_MAX),
  });
}

// --- errors ---

const codeOf = (error: unknown): Code | undefined =>
  error instanceof ConnectError ? error.code : undefined;

export const isAlreadyExists = (error: unknown) => codeOf(error) === Code.AlreadyExists;
export const isNotFound = (error: unknown) => codeOf(error) === Code.NotFound;
export const isUnimplemented = (error: unknown) => codeOf(error) === Code.Unimplemented;

/** What a failed review action tells the reader. */
export function reviewErrorMessage(error: unknown, fallback: string): string {
  switch (codeOf(error)) {
    case Code.Unimplemented:
      return `${fallback} This isn't available on the server yet.`;
    case Code.Unauthenticated:
      return "Sign in again to continue.";
    case Code.PermissionDenied:
      return `${fallback} You can't do that to this review.`;
    case Code.AlreadyExists:
      return "You've already reviewed this place.";
    case Code.NotFound:
      return `${fallback} It may have been deleted.`;
  }
  if (error instanceof ConnectError && error.rawMessage) return error.rawMessage;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
