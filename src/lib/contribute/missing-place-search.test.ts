import { describe, expect, it } from "vitest";
import { missingPlaceSearchFilters, NEARBY_CITY } from "./missing-place-search";

describe("missingPlaceSearchFilters", () => {
  const here = { latitude: 38.72, longitude: -9.14 };

  it("never sends an empty city on a located search", () => {
    const f = missingPlaceSearchFilters(here, "  ");
    expect(f).toEqual({
      cityName: NEARBY_CITY,
      latitude: 38.72,
      longitude: -9.14,
      radiusKm: 25,
      searchType: "hybrid",
    });
  });

  it("keeps a typed city on a located search", () => {
    expect(missingPlaceSearchFilters(here, " Lisbon ")?.cityName).toBe("Lisbon");
  });

  it("scopes an unlocated search by the typed city", () => {
    expect(missingPlaceSearchFilters(null, "Porto")).toEqual({
      cityName: "Porto",
      searchType: "semantic",
    });
  });

  it("refuses an unlocated search with no city rather than send one that fails validation", () => {
    expect(missingPlaceSearchFilters(null, "")).toBeNull();
    expect(missingPlaceSearchFilters(undefined, "   ")).toBeNull();
  });
});
