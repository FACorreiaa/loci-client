import { describe, expect, it } from "vitest";
import type { VisitedPlace } from "~/lib/api/travel-history";
import { groupVisitsByCity, withoutVisit } from "./group";

const visit = (poiName: string, cityName: string, day: number): VisitedPlace => ({
  id: `${poiName}-id`,
  poiId: `${poiName}-poi`,
  poiName,
  cityName,
  source: "manual",
  visitedAt: new Date(Date.UTC(2026, 8, day)),
});

describe("groupVisitsByCity", () => {
  it("groups by city, newest city first and newest visit first within it", () => {
    const groups = groupVisitsByCity([
      visit("Sé", "Lisbon", 1),
      visit("Ribeira", "Porto", 5),
      visit("Belém", "Lisbon", 3),
    ]);
    expect(groups.map((g) => g.city)).toEqual(["Porto", "Lisbon"]);
    expect(groups[1].places.map((p) => p.poiName)).toEqual(["Belém", "Sé"]);
  });

  it("files a visit with no city under a readable label", () => {
    const groups = groupVisitsByCity([{ ...visit("Somewhere", "", 2) }]);
    expect(groups[0].city).toBe("Other places");
  });
});

describe("withoutVisit", () => {
  it("removes one visit by id and leaves the page total in step", () => {
    const page = { places: [visit("A", "Lisbon", 1), visit("B", "Lisbon", 2)], total: 2 };
    expect(withoutVisit(page, "A-id")).toEqual({ places: [page.places[1]], total: 1 });
  });

  it("is a no-op for an id that is not on the page", () => {
    const page = { places: [visit("A", "Lisbon", 1)], total: 1 };
    expect(withoutVisit(page, "nope")).toBe(page);
  });
});
