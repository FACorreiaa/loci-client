import { describe, expect, it } from "vitest";
import {
  eatNearbyGoogleUrl,
  eatNearbySummary,
  filterEatNearby,
  placeDistanceKm,
  walkMinutes,
  type NearbyPlace,
} from "./eat-nearby";

const place = (over: Partial<NearbyPlace> & { id: string; name: string }): NearbyPlace => over;

describe("filterEatNearby", () => {
  it("lists nearest first with a walking time", () => {
    const got = filterEatNearby(
      [
        place({ id: "2", name: "Far", distanceKm: 0.6 }),
        place({ id: "1", name: "Near", distanceKm: 0.16 }),
      ],
      [],
    );
    expect(got.map((p) => [p.name, p.walkMinutes])).toEqual([
      ["Near", 2],
      ["Far", 8],
    ]);
  });

  it("leaves out what is already on the trip, by id or by name", () => {
    const got = filterEatNearby(
      [
        place({ id: "P1", name: "Same id" }),
        place({ id: "p2", name: "Pastéis de Belém" }),
        place({ id: "p3", name: "New place" }),
      ],
      [{ poiId: "p1", name: "Something else" }, { name: "pasteis de belem" }],
    );
    expect(got.map((p) => p.name)).toEqual(["New place"]);
  });

  it("shows a place once and stops at the cap", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      place({ id: String(i), name: `Place ${i}`, distanceKm: i / 100 }),
    );
    many.push(place({ id: "dup", name: "place 0", distanceKm: 0.5 }));
    const got = filterEatNearby(many, []);
    expect(got).toHaveLength(8);
    expect(got.filter((p) => p.name.toLowerCase() === "place 0")).toHaveLength(1);
  });
});

describe("what the panel says", () => {
  it("never claims more than it has", () => {
    expect(eatNearbySummary(0, "Castelo")).toContain("doesn't know anywhere");
    expect(eatNearbySummary(1, "Castelo")).toContain("only knows 1 place ");
    expect(eatNearbySummary(2, "Castelo")).toContain("only knows 2 places");
    expect(eatNearbySummary(5, "Castelo")).toBe(
      "Places Loci knows within a 10-minute walk of Castelo.",
    );
  });

  it("walks at least a minute, and says nothing without a distance", () => {
    expect(walkMinutes(0.01)).toBe(1);
    expect(walkMinutes(0.8)).toBe(10);
    expect(walkMinutes(undefined)).toBeUndefined();
  });

  it("links to Google's list by name and city, with no coordinates needed", () => {
    expect(eatNearbyGoogleUrl("Castelo de São Jorge", "Lisbon")).toBe(
      "https://www.google.com/maps/search/?api=1&query=restaurants%20near%20Castelo%20de%20S%C3%A3o%20Jorge%2C%20Lisbon",
    );
    expect(eatNearbyGoogleUrl("Castelo")).toContain("restaurants%20near%20Castelo");
  });
});

describe("placeDistanceKm", () => {
  const stop = { latitude: 37.3831, longitude: -5.9902 };
  const bar = { latitude: 37.3856, longitude: -5.9902 }; // ~280 m north

  it("uses the server's figure when it sent one", () => {
    expect(placeDistanceKm(0.5, stop, bar)).toBe(0.5);
  });

  // An older API never filled distance in, and protobuf hands back 0, which
  // put "1 min walk" on every place.
  it("measures from the positions when the server sent 0", () => {
    const km = placeDistanceKm(0, stop, bar)!;
    expect(km).toBeGreaterThan(0.25);
    expect(km).toBeLessThan(0.31);
    expect(walkMinutes(km)).toBe(3);
  });

  it("is unknown without both positions", () => {
    expect(placeDistanceKm(undefined, stop, {})).toBeUndefined();
    expect(placeDistanceKm(0, { latitude: 0, longitude: 0 }, bar)).toBeUndefined();
  });
});
