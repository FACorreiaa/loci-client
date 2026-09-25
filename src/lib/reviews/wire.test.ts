import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  ReviewSchema,
  ReviewStatisticsSchema,
  UserReviewStatisticsSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/review/review_pb.js";
import {
  buildCreateRequest,
  buildLikeRequest,
  buildMyPOIReviewRequest,
  buildPOIReviewsRequest,
  buildReportRequest,
  buildUpdateRequest,
  buildUserReviewsRequest,
  canReview,
  isAlreadyExists,
  isNotFound,
  pageHasMore,
  reviewErrorMessage,
  toMineSummary,
  toReview,
  toStats,
} from "./wire";

const POI = "0b7c9a4e-2f1d-4c3b-9a8e-1d2c3b4a5f6e";
const form = {
  rating: 4,
  title: "  Worth the queue  ",
  content: "  Go early, the light is best before ten.  ",
  visitDate: "2026-03-05",
};

describe("who can be reviewed", () => {
  it("only a stored place (UUID) gets reviews", () => {
    expect(canReview(POI)).toBe(true);
    expect(canReview("")).toBe(false);
    expect(canReview(undefined)).toBe(false);
    expect(canReview("Belém Tower|38.69|-9.21")).toBe(false);
  });

  it("never sends an empty or name-keyed poi id", () => {
    expect(() => buildPOIReviewsRequest("", 1)).toThrow();
    expect(() => buildCreateRequest("Belém Tower", form)).toThrow();
    expect(() => buildMyPOIReviewRequest("")).toThrow();
  });
});

describe("request builders", () => {
  it("create: whole stars, trimmed text, visit day at noon UTC, no user id, no photos", () => {
    const req = buildCreateRequest(POI, { ...form, rating: 3.6 });
    expect(req.poiId).toBe(POI);
    expect(req.rating).toBe(4);
    expect(req.title).toBe("Worth the queue");
    expect(req.content).toBe("Go early, the light is best before ten.");
    expect(req.visitDate).toEqual(timestampFromDate(new Date("2026-03-05T12:00:00Z")));
    expect(req.userId).toBe("");
    expect(req.photoUrls).toEqual([]);
  });

  it("create: no visit day sends none", () => {
    expect(buildCreateRequest(POI, { ...form, visitDate: "" }).visitDate).toBeUndefined();
  });

  it("update: sends the whole review, and no visit day clears it", () => {
    const req = buildUpdateRequest("r1", { ...form, visitDate: "" });
    expect(req.reviewId).toBe("r1");
    expect(req.title).toBe("Worth the queue");
    expect(req.visitDate).toBeUndefined();
    expect(req.userId).toBe("");
  });

  it("like: isLike is the new state", () => {
    expect(buildLikeRequest("r1", true).isLike).toBe(true);
    expect(buildLikeRequest("r1", false).isLike).toBe(false);
  });

  it("report: one of the five reasons, details trimmed", () => {
    const req = buildReportRequest("r1", "fake", "  same text on 4 places ");
    expect(req.reason).toBe("fake");
    expect(req.details).toBe("same text on 4 places");
    expect(() => buildReportRequest("r1", "rude" as never)).toThrow();
  });

  it("paging: page is at least 1; My reviews sends no user id", () => {
    expect(buildPOIReviewsRequest(POI, 0).pagination?.page).toBe(1);
    expect(buildPOIReviewsRequest(POI, 2).pagination).toMatchObject({ page: 2, pageSize: 20 });
    const mine = buildUserReviewsRequest(3);
    expect(mine.userId).toBe("");
    expect(mine.pagination).toMatchObject({ page: 3, pageSize: 20 });
  });

  it("knows when another page follows", () => {
    expect(pageHasMore({ totalRecords: 45, page: 2, pageSize: 20 }, 2, 20, 20)).toBe(true);
    expect(pageHasMore({ totalRecords: 40, page: 2, pageSize: 20 }, 2, 20, 20)).toBe(false);
    // Without a total, a full page means maybe more.
    expect(pageHasMore(undefined, 1, 20, 20)).toBe(true);
    expect(pageHasMore(undefined, 1, 20, 7)).toBe(false);
  });
});

describe("mapping", () => {
  it("maps a review, including voted_by_me", () => {
    const r = toReview(
      create(ReviewSchema, {
        id: "r1",
        userId: "u1",
        poiId: POI,
        rating: 4.4,
        content: "text",
        helpfulCount: 3,
        votedByMe: true,
        contentName: "Belém Tower",
        visitDate: timestampFromDate(new Date("2026-03-05T12:00:00Z")),
        reviewer: { displayName: "Ana" },
      }),
    );
    expect(r).toMatchObject({
      id: "r1",
      poiId: POI,
      rating: 4,
      helpful: 3,
      votedByMe: true,
      poiName: "Belém Tower",
      reviewerName: "Ana",
      visitDate: "2026-03-05T12:00:00.000Z",
    });
    expect(r.createdAt).toBeUndefined();
  });

  it("falls back to content_id for the place", () => {
    expect(toReview(create(ReviewSchema, { id: "r", contentId: POI, rating: 5 })).poiId).toBe(POI);
  });

  it("maps place statistics", () => {
    const stats = toStats(
      create(ReviewStatisticsSchema, {
        overallRating: 4.2,
        totalReviews: 5,
        ratingBreakdown: { oneStar: 0, twoStar: 0, threeStar: 1, fourStar: 2, fiveStar: 2 },
      }),
    );
    expect(stats).toEqual({
      average: 4.2,
      total: 5,
      breakdown: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 2 },
    });
    expect(toStats(undefined).total).toBe(0);
  });

  it("maps My reviews statistics, and none when the server leaves them empty", () => {
    expect(
      toMineSummary(
        create(UserReviewStatisticsSchema, {
          totalReviews: 3,
          averageRatingGiven: 4,
          helpfulVotesReceived: 2,
          ratingDistribution: { threeStar: 1, fiveStar: 2 },
        }),
      ),
    ).toEqual({
      count: 3,
      averageGiven: 4,
      helpfulReceived: 2,
      distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 },
    });
    expect(toMineSummary(create(UserReviewStatisticsSchema, {}))).toBeUndefined();
    expect(toMineSummary(undefined)).toBeUndefined();
  });
});

describe("errors", () => {
  it("classifies the codes the page acts on", () => {
    expect(isAlreadyExists(new ConnectError("x", Code.AlreadyExists))).toBe(true);
    expect(isNotFound(new ConnectError("x", Code.NotFound))).toBe(true);
    expect(isNotFound(new Error("not found"))).toBe(false);
  });

  it("says a missing RPC is the server's, not the reader's", () => {
    expect(reviewErrorMessage(new ConnectError("x", Code.Unimplemented), "Couldn't vote.")).toBe(
      "Couldn't vote. This isn't available on the server yet.",
    );
    expect(reviewErrorMessage(new ConnectError("too short", Code.InvalidArgument), "F")).toBe(
      "too short",
    );
    expect(reviewErrorMessage("??", "Fallback")).toBe("Fallback");
  });
});
