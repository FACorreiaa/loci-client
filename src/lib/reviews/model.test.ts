import { describe, expect, it } from "vitest";

import {
  clampRating,
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

  it("summarises my reviews from the rows, since the server leaves statistics empty", () => {
    expect(summariseMine([])).toEqual({ count: 0, averageGiven: 0, helpfulReceived: 0 });
    expect(
      summariseMine([
        { rating: 4, helpful: 2 },
        { rating: 5, helpful: 0 },
      ]),
    ).toEqual({ count: 2, averageGiven: 4.5, helpfulReceived: 2 });
  });
});
