import { describe, expect, it } from "vitest";
import { dayCentroid, distanceKm, pickDaySuggestions } from "./day-suggestions";

const lisbon = { latitude: 38.7139, longitude: -9.1335 };
// ~1.1 km north per 0.01 degree of latitude.
const north = (d: number) => ({ latitude: lisbon.latitude + d, longitude: lisbon.longitude });

describe("dayCentroid", () => {
  it("is the middle of the placed stops and ignores the rest", () => {
    expect(dayCentroid([north(0), north(0.02), {}, { latitude: 0, longitude: 0 }])).toEqual(
      north(0.01),
    );
    expect(dayCentroid([{}, { latitude: 0, longitude: 0 }])).toBeUndefined();
  });

  it("measures real distance", () => {
    expect(distanceKm(lisbon, north(0.01))).toBeCloseTo(1.11, 1);
  });
});

describe("pickDaySuggestions", () => {
  it("puts the generation's extras first, then nearby places by rating", () => {
    const got = pickDaySuggestions({
      centroid: lisbon,
      onTrip: [],
      extras: [{ name: "Extra", ...north(0.005), rating: 3.9 }],
      nearby: [
        { name: "Ok museum", ...north(0.002), rating: 4.1 },
        { name: "Great museum", ...north(0.004), rating: 4.8 },
      ],
    });
    expect(got.map((s) => [s.name, s.source])).toEqual([
      ["Extra", "extras"],
      ["Great museum", "nearby"],
      ["Ok museum", "nearby"],
    ]);
  });

  it("leaves out what is on the trip, food, repeats and anything too far", () => {
    const got = pickDaySuggestions({
      centroid: lisbon,
      onTrip: ["Sé de Lisboa"],
      extras: [
        { name: "se de lisboa", ...north(0.001) },
        { name: "Far extra", ...north(0.05) },
        { name: "Tasca", category: "Restaurant", ...north(0.001) },
        { name: "Viewpoint", ...north(0.001) },
      ],
      nearby: [
        { name: "viewpoint", ...north(0.001) },
        { name: "Too far nearby", ...north(0.02) },
        { name: "Coffee", category: "cafe", ...north(0.001) },
      ],
    });
    expect(got.map((s) => s.name)).toEqual(["Viewpoint"]);
  });

  it("does not call an unplaced extra near a day that has a position", () => {
    const got = pickDaySuggestions({
      centroid: lisbon,
      onTrip: [],
      extras: [{ name: "Nowhere" }],
      nearby: [],
    });
    expect(got).toEqual([]);
  });

  it("offers extras as they come when the day has no position at all", () => {
    const got = pickDaySuggestions({
      onTrip: [],
      extras: [{ name: "A" }, { name: "B" }],
      nearby: [],
    });
    expect(got.map((s) => s.name)).toEqual(["A", "B"]);
    expect(got[0].distanceKm).toBeUndefined();
  });

  it("stops at four", () => {
    const got = pickDaySuggestions({
      centroid: lisbon,
      onTrip: [],
      extras: Array.from({ length: 9 }, (_, i) => ({ name: `E${i}`, ...north(0.001) })),
      nearby: [],
    });
    expect(got).toHaveLength(4);
  });

  it("does not offer a stop the trip already has under another name", () => {
    const picks = pickDaySuggestions({
      centroid: { latitude: 37.3833, longitude: -5.9902 },
      onTrip: ["Real Alcázar de Sevilla"],
      onTripAt: [{ latitude: 37.3831, longitude: -5.9902 }],
      extras: [
        { name: "Real Alcázar of Seville", latitude: 37.38312, longitude: -5.99025 },
        { name: "Jardines de Murillo", latitude: 37.3838, longitude: -5.9879 },
      ],
      nearby: [],
    });
    expect(picks.map((p) => p.name)).toEqual(["Jardines de Murillo"]);
  });

  it("reads food as a word in the kind, not as a run of letters", () => {
    const at = { latitude: 1, longitude: 1 };
    const picks = pickDaySuggestions({
      centroid: at,
      onTrip: [],
      extras: [
        { name: "A", category: "Tapas Bar", latitude: 1.001, longitude: 1 },
        { name: "B", category: "Barrio", latitude: 1.002, longitude: 1 },
        { name: "C", category: "Historic Cafés", latitude: 1.003, longitude: 1 },
      ],
      nearby: [],
    });
    expect(picks.map((p) => p.name)).toEqual(["B"]);
  });
});
