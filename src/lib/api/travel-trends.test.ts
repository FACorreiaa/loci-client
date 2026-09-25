import { describe, expect, it } from "vitest";
import { hasWindowCounts, summaryTrends, trendPercent } from "./travel-trends";

const base = {
  citiesVisited: 12,
  countriesVisited: 5,
  poisVisited: 40,
  citiesVisitedPrev: 0,
  countriesVisitedPrev: 0,
  poisVisitedPrev: 0,
  citiesVisitedThis: 0,
  countriesVisitedThis: 0,
  poisVisitedThis: 0,
};

describe("trendPercent", () => {
  it("is null with no prior period", () => {
    expect(trendPercent(5, 0)).toBeNull();
  });
  it("is the relative change", () => {
    expect(trendPercent(15, 10)).toBe(50);
    expect(trendPercent(5, 10)).toBe(-50);
  });
});

describe("summaryTrends", () => {
  it("compares the all-time totals with prev on a server without window counts", () => {
    const s = { ...base, citiesVisitedPrev: 8, countriesVisitedPrev: 5, poisVisitedPrev: 20 };
    expect(hasWindowCounts(s)).toBe(false);
    expect(summaryTrends(s)).toEqual({ cities: 50, countries: 0, pois: 100 });
  });

  it("compares this window with the previous one when the server sends window counts", () => {
    const s = {
      ...base,
      citiesVisitedThis: 3,
      citiesVisitedPrev: 6,
      countriesVisitedThis: 2,
      countriesVisitedPrev: 1,
      poisVisitedThis: 0,
      poisVisitedPrev: 4,
    };
    expect(hasWindowCounts(s)).toBe(true);
    // Totals (12/5/40) are ignored: a trend can now go down.
    expect(summaryTrends(s)).toEqual({ cities: -50, countries: 100, pois: -100 });
  });

  it("renders no arrow for a window with no previous-window baseline", () => {
    const s = { ...base, citiesVisitedThis: 4 };
    expect(summaryTrends(s)).toEqual({ cities: null, countries: null, pois: null });
  });

  it("renders no arrows for an empty summary", () => {
    expect(
      summaryTrends({ ...base, citiesVisited: 0, countriesVisited: 0, poisVisited: 0 }),
    ).toEqual({ cities: null, countries: null, pois: null });
  });
});
