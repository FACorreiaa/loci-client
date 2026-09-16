import { describe, expect, it } from "vitest";
import type { Trip, TripDay } from "~/lib/api/trips";
import { TripPace } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import {
  daysUntil,
  otherTrips,
  pickNextTrip,
  tripCoords,
  tripDateRange,
  tripStopCount,
  untilLabel,
} from "./next-trip";

// Wednesday 16 Sep 2026, noon local.
const now = new Date(2026, 8, 16, 12);

interface MakeTrip extends Partial<Omit<Trip, "days">> {
  dates?: (string | undefined)[];
  days?: TripDay[];
}

let seq = 0;
const makeTrip = ({ dates, days, ...rest }: MakeTrip = {}): Trip => {
  const id = rest.id ?? `trip-${++seq}`;
  return {
    id,
    userId: "u",
    cityName: "Porto",
    title: "Porto weekend",
    constraints: { pace: TripPace.UNSPECIFIED, interests: [] },
    days:
      days ??
      (dates ?? []).map((date, i) => ({
        id: `${id}-d${i}`,
        dayNumber: i + 1,
        date,
        stops: [],
      })),
    version: 0n,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...rest,
  };
};

describe("pickNextTrip", () => {
  it("returns undefined with no trips", () => {
    expect(pickNextTrip([], now)).toBeUndefined();
  });

  it("picks the only future trip and marks it upcoming", () => {
    const t = makeTrip({ dates: ["2026-10-04", "2026-10-05"] });
    expect(pickNextTrip([t], now)).toEqual({ trip: t, upcoming: true });
  });

  it("picks the earliest of several future trips", () => {
    const later = makeTrip({ dates: ["2026-11-01"] });
    const sooner = makeTrip({ dates: ["2026-10-04"] });
    expect(pickNextTrip([later, sooner], now)?.trip).toBe(sooner);
  });

  it("prefers a trip already underway over a later one", () => {
    const underway = makeTrip({ dates: ["2026-09-15", "2026-09-17"] });
    const later = makeTrip({ dates: ["2026-10-04"] });
    expect(pickNextTrip([later, underway], now)).toEqual({ trip: underway, upcoming: true });
  });

  it("falls back to the most recently updated trip when none is ahead", () => {
    const old = makeTrip({ dates: ["2026-08-01"], updatedAt: "2026-08-02T00:00:00.000Z" });
    const newer = makeTrip({ dates: ["2026-07-01"], updatedAt: "2026-09-10T00:00:00.000Z" });
    expect(pickNextTrip([old, newer], now)).toEqual({ trip: newer, upcoming: false });
  });

  it("ignores undated trips when a dated future trip exists", () => {
    const undated = makeTrip({ dates: [undefined], updatedAt: "2026-09-15T00:00:00.000Z" });
    const future = makeTrip({ dates: ["2026-10-04"] });
    expect(pickNextTrip([undated, future], now)?.trip).toBe(future);
  });

  it("falls back to the newest undated trip when nothing is dated", () => {
    const a = makeTrip({ updatedAt: "2026-09-01T00:00:00.000Z" });
    const b = makeTrip({ updatedAt: "2026-09-12T00:00:00.000Z" });
    expect(pickNextTrip([a, b], now)).toEqual({ trip: b, upcoming: false });
  });

  it("treats invalid date strings as undated", () => {
    const broken = makeTrip({ dates: ["soon"] });
    const future = makeTrip({ dates: ["2026-10-04"] });
    expect(pickNextTrip([broken, future], now)?.trip).toBe(future);
  });
});

describe("daysUntil", () => {
  it("is 0 for a trip starting today", () => {
    expect(daysUntil(makeTrip({ dates: ["2026-09-16"] }), now)).toBe(0);
  });

  it("is 1 for tomorrow", () => {
    expect(daysUntil(makeTrip({ dates: ["2026-09-17"] }), now)).toBe(1);
  });

  it("counts calendar days, not 24-hour spans", () => {
    const lateTonight = new Date(2026, 8, 16, 23, 59);
    expect(daysUntil(makeTrip({ dates: ["2026-09-17"] }), lateTonight)).toBe(1);
  });

  it("is negative while underway", () => {
    expect(daysUntil(makeTrip({ dates: ["2026-09-14", "2026-09-18"] }), now)).toBe(-2);
  });

  it("is undefined for an undated trip", () => {
    expect(daysUntil(makeTrip(), now)).toBeUndefined();
  });
});

describe("untilLabel", () => {
  it("names today, tomorrow, a count, underway, or nothing", () => {
    expect(untilLabel(0)).toBe("today");
    expect(untilLabel(1)).toBe("tomorrow");
    expect(untilLabel(12)).toBe("in 12 days");
    expect(untilLabel(-1)).toBe("underway");
    expect(untilLabel(undefined)).toBeUndefined();
  });
});

describe("tripCoords", () => {
  it("takes the first day with both coordinates", () => {
    const t = makeTrip({
      days: [
        { id: "a", dayNumber: 1, stops: [], cityLat: 41.15 },
        { id: "b", dayNumber: 2, stops: [], cityLat: 41.15, cityLon: -8.61 },
      ],
    });
    expect(tripCoords(t)).toEqual({ lat: 41.15, lon: -8.61 });
  });

  it("is undefined when no day is placed", () => {
    expect(tripCoords(makeTrip({ dates: ["2026-10-04"] }))).toBeUndefined();
  });
});

describe("tripStopCount", () => {
  it("sums stops across days", () => {
    const stop = (n: string) => ({ id: n, poiId: n, orderIndex: 0, name: n, notes: "" });
    const t = makeTrip({
      days: [
        { id: "a", dayNumber: 1, stops: [stop("1"), stop("2")] },
        { id: "b", dayNumber: 2, stops: [stop("3"), stop("4"), stop("5")] },
      ],
    });
    expect(tripStopCount(t)).toBe(5);
    expect(tripStopCount(makeTrip())).toBe(0);
  });
});

describe("tripDateRange", () => {
  it("is undefined when undated and a range when dated", () => {
    expect(tripDateRange(makeTrip())).toBeUndefined();
    const s = tripDateRange(makeTrip({ dates: ["2026-10-04", "2026-10-06"] }))!;
    expect(s).toContain("4");
    expect(s).toContain("6");
  });
});

describe("otherTrips", () => {
  const trips = [
    makeTrip({ id: "a", updatedAt: "2026-09-01T00:00:00.000Z" }),
    makeTrip({ id: "b", updatedAt: "2026-09-05T00:00:00.000Z" }),
    makeTrip({ id: "c", updatedAt: "2026-09-03T00:00:00.000Z" }),
    makeTrip({ id: "d", updatedAt: "2026-09-04T00:00:00.000Z" }),
    makeTrip({ id: "e", updatedAt: "2026-09-02T00:00:00.000Z" }),
  ];

  it("drops the excluded trip and orders newest first", () => {
    expect(otherTrips(trips, "b").map((t) => t.id)).toEqual(["d", "c", "e", "a"]);
  });

  it("caps at the limit", () => {
    expect(otherTrips(trips, undefined, 2).map((t) => t.id)).toEqual(["b", "d"]);
  });

  it("excludes nothing when no id is given", () => {
    expect(otherTrips(trips, undefined)).toHaveLength(4);
    expect(otherTrips(trips, undefined, 10)).toHaveLength(5);
  });
});
