import { describe, expect, it } from "vitest";

import {
  REPORT_REASONS,
  beginVote,
  breakdownShares,
  clampRating,
  isReportReason,
  mineSummary,
  rollbackVote,
  settleVote,
  shownVote,
  visitDayFromISO,
  visitDayToDate,
  visitLabel,
  foldText,
  formIssues,
  formIssueMessage,
  needsFold,
  nextVote,
  ratingLabel,
  ratingTone,
  summariseMine,
} from "./model";

// Ported from loci-ios ReviewModelTests so both clients read reviews the same way.
describe("ratings", () => {
  it("labels match iOS", () => {
    expect([1, 2, 3, 4, 5].map(ratingLabel)).toEqual([
      "Terrible",
      "Poor",
      "Average",
      "Good",
      "Excellent",
    ]);
    expect(ratingLabel(0)).toBe("");
    expect(ratingLabel(6)).toBe("");
  });

  it("tone thresholds are four and three", () => {
    expect(ratingTone(5)).toBe("high");
    expect(ratingTone(4)).toBe("high");
    expect(ratingTone(3.9)).toBe("middle");
    expect(ratingTone(3)).toBe("middle");
    expect(ratingTone(2.9)).toBe("low");
  });

  it("server ratings clamp to whole stars", () => {
    expect(clampRating(4)).toBe(4);
    expect(clampRating(0)).toBe(1);
    expect(clampRating(9)).toBe(5);
    expect(clampRating(Number.NaN)).toBe(1);
    expect(clampRating(3.6)).toBe(4);
  });
});

describe("form rules", () => {
  it("needs a rating and ten characters", () => {
    expect(formIssues({ rating: 0, title: "", content: "" })).toEqual(["noRating", "noContent"]);
    expect(formIssues({ rating: 4, title: "", content: "   " })).toEqual(["noContent"]);
    expect(formIssues({ rating: 4, title: "", content: "  123456789  " })).toEqual([
      "contentTooShort",
    ]);
    expect(formIssues({ rating: 4, title: "", content: "1234567890" })).toEqual([]);
  });

  it("enforces the limits", () => {
    expect(formIssues({ rating: 5, title: "", content: "a".repeat(1001) })).toEqual([
      "contentTooLong",
    ]);
    expect(formIssues({ rating: 5, title: "", content: "a".repeat(1000) })).toEqual([]);
    expect(formIssues({ rating: 5, title: "t".repeat(101), content: "long enough" })).toEqual([
      "titleTooLong",
    ]);
    expect(formIssueMessage("contentTooShort")).toBe("Review must be at least 10 characters");
  });
});

describe("text and votes", () => {
  it("folds after two hundred characters", () => {
    const exact = "x".repeat(200);
    expect(needsFold(exact)).toBe(false);
    expect(foldText(exact)).toBe(exact);
    const longer = "y".repeat(201);
    expect(needsFold(longer)).toBe(true);
    expect(foldText(longer)).toBe("y".repeat(199) + "…");
  });

  it("a helpful vote toggles and the count follows", () => {
    expect(nextVote({ voted: false, helpful: 3 })).toEqual({
      voted: true,
      helpful: 4,
      isLike: true,
    });
    expect(nextVote({ voted: true, helpful: 4 })).toEqual({
      voted: false,
      helpful: 3,
      isLike: false,
    });
    expect(nextVote({ voted: true, helpful: 0 })).toEqual({
      voted: false,
      helpful: 0,
      isLike: false,
    });
  });

  it("summarises my reviews from the rows when the server sends no statistics", () => {
    const none = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    expect(summariseMine([])).toEqual({
      count: 0,
      averageGiven: 0,
      helpfulReceived: 0,
      distribution: none,
    });
    expect(
      summariseMine([
        { rating: 4, helpful: 2 },
        { rating: 5, helpful: 0 },
      ]),
    ).toEqual({
      count: 2,
      averageGiven: 4.5,
      helpfulReceived: 2,
      distribution: { ...none, 4: 1, 5: 1 },
    });
  });

  it("prefers the server's statistics, which cover every page", () => {
    const server = {
      count: 30,
      averageGiven: 4.26,
      helpfulReceived: 9,
      distribution: { 1: 1, 2: 2, 3: 3, 4: 10, 5: 14 },
    };
    expect(mineSummary(server, [{ rating: 1, helpful: 0 }])).toEqual({
      ...server,
      averageGiven: 4.3,
    });
    expect(mineSummary(undefined, [{ rating: 3, helpful: 1 }]).count).toBe(1);
    expect(mineSummary({ ...server, count: 0 }, [{ rating: 3, helpful: 1 }]).averageGiven).toBe(3);
  });
});

describe("vote state", () => {
  const review = { votedByMe: true, helpful: 5 };

  it("starts from the server's voted_by_me", () => {
    expect(shownVote(review, undefined)).toEqual({ voted: true, helpful: 5, pending: false });
    expect(shownVote({ votedByMe: false, helpful: 0 }, undefined).voted).toBe(false);
  });

  it("a tap on a voted review un-votes (isLike false) and is optimistic", () => {
    const next = beginVote(shownVote(review, undefined));
    expect(next).toEqual({ voted: false, helpful: 4, pending: true, isLike: false });
  });

  it("ignores a second tap while a vote is in flight", () => {
    const next = beginVote({ voted: false, helpful: 1, pending: false })!;
    expect(next.isLike).toBe(true);
    expect(beginVote(next)).toBeNull();
  });

  it("settles on the server's count, and rolls back on failure", () => {
    const before = { voted: false, helpful: 1, pending: false };
    const next = beginVote(before)!;
    expect(settleVote(next, 7)).toEqual({ voted: true, helpful: 7, pending: false });
    expect(settleVote(next, -1).helpful).toBe(0);
    expect(rollbackVote(before)).toEqual(before);
  });
});

describe("visit day", () => {
  it("sends the picked day at noon UTC", () => {
    expect(visitDayToDate("2026-03-05")?.toISOString()).toBe("2026-03-05T12:00:00.000Z");
    expect(visitDayToDate("")).toBeUndefined();
    expect(visitDayToDate("05/03/2026")).toBeUndefined();
  });

  it("reads it back as the same day and month in UTC", () => {
    expect(visitDayFromISO("2026-03-05T12:00:00.000Z")).toBe("2026-03-05");
    expect(visitDayFromISO(undefined)).toBe("");
    expect(visitLabel("2026-03-01T12:00:00.000Z", "en-GB")).toBe("Visited March 2026");
    // Late on the last day in UTC is still that month, wherever the reader is.
    expect(visitLabel("2026-03-31T23:30:00.000Z", "en-GB")).toBe("Visited March 2026");
  });
});

describe("statistics", () => {
  it("bars are shares of the breakdown's own sum", () => {
    expect(breakdownShares({ 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 })).toEqual({
      1: 0,
      2: 0,
      3: 25,
      4: 25,
      5: 50,
    });
    expect(breakdownShares({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })[5]).toBe(0);
  });

  it("report reasons are the five the server accepts", () => {
    expect(REPORT_REASONS.map((r) => r.value)).toEqual([
      "spam",
      "inappropriate",
      "fake",
      "offensive",
      "other",
    ]);
    expect(isReportReason("fake")).toBe(true);
    expect(isReportReason("rude")).toBe(false);
  });
});
