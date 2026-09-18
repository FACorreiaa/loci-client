import { describe, expect, it } from "vitest";
import { pointsFromDays, type DayLike } from "./points";

const stop = (name: string, lat?: number, lon?: number) => ({
  id: name,
  name,
  poi: lat === undefined ? undefined : { latitude: lat, longitude: lon, category: "museum" },
});

describe("pointsFromDays", () => {
  it("converts the server's 1-based day to the 0-based day the list groups on", () => {
    // Passing the server's number straight through renders a three-day pack as
    // Day 2 to Day 4, with no Day 1 at all.
    const days: DayLike[] = [{ dayNumber: 1, stops: [stop("a", 38.7, -9.1)] }];
    expect(pointsFromDays(days)[0].day).toBe(0);
  });

  it("skips a stop with no position rather than placing it at 0,0", () => {
    // 0,0 is in the Atlantic. It would draw a marker in the ocean and pass
    // every null check on the way there.
    const days: DayLike[] = [
      { dayNumber: 1, stops: [stop("placed", 38.7, -9.1), stop("unplaced")] },
    ];
    const points = pointsFromDays(days);
    expect(points).toHaveLength(1);
    expect(points[0].name).toBe("placed");
  });

  it("numbers stops across the whole pack, not per day", () => {
    const days: DayLike[] = [
      { dayNumber: 1, stops: [stop("a", 1, 1), stop("b", 2, 2)] },
      { dayNumber: 2, stops: [stop("c", 3, 3)] },
    ];
    const points = pointsFromDays(days);
    expect(points.map((p) => p.seq)).toEqual([1, 2, 3]);
    expect(points.map((p) => p.day)).toEqual([0, 0, 1]);
  });

  it("keeps numbering contiguous when a positionless stop is skipped", () => {
    // seq drives the marker labels, so a gap would number the map 1, 3.
    const days: DayLike[] = [
      { dayNumber: 1, stops: [stop("a", 1, 1), stop("skipped"), stop("c", 3, 3)] },
    ];
    expect(pointsFromDays(days).map((p) => p.seq)).toEqual([1, 2]);
  });

  it("returns nothing when no stop has a position", () => {
    expect(pointsFromDays([{ dayNumber: 1, stops: [stop("nowhere")] }])).toEqual([]);
  });

  it("falls back to a composed id when a stop has none", () => {
    const days: DayLike[] = [
      { dayNumber: 2, stops: [{ name: "x", poi: { latitude: 1, longitude: 2 } }] },
    ];
    expect(pointsFromDays(days)[0].id).toBe("2-0");
  });
});
