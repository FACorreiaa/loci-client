import { describe, expect, it } from "vitest";
import type { Trip, TripStop } from "~/lib/api/trips";
import { TripPace } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { pickToday, todayOf } from "./today";

// Tuesday 20 Oct 2026, 13:30 local.
const now = new Date(2026, 9, 20, 13, 30);

const stop = (name: string, startMinute?: number): TripStop => ({
  id: name,
  poiId: "",
  orderIndex: 0,
  name,
  startMinute,
  notes: "",
});

const makeTrip = (id: string, dates: string[], stops: TripStop[][] = []): Trip => ({
  id,
  userId: "u",
  cityName: "Lisbon",
  title: "Lisbon",
  constraints: { pace: TripPace.UNSPECIFIED, interests: [] },
  stays: [],
  flights: [],
  days: dates.map((date, i) => ({
    id: `${id}-d${i}`,
    dayNumber: i + 1,
    date,
    stops: stops[i] ?? [],
  })),
  version: 0n,
  createdAt: "",
  updatedAt: "",
});

describe("todayOf", () => {
  it("reads a server date as the calendar day it names, west of UTC too", () => {
    // The API carries a day as midnight UTC; in Los Angeles that instant is
    // still the 19th, so a local reading would lead with the wrong day.
    const tz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const morning = new Date(2026, 9, 20, 9, 0);
      const trip = makeTrip("w", ["2026-10-19T00:00:00.000Z", "2026-10-20T00:00:00.000Z"]);
      expect(todayOf(trip, morning)?.day.dayNumber).toBe(2);
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });

  it("is undefined outside the trip", () => {
    expect(todayOf(makeTrip("a", ["2026-10-21", "2026-10-22"]), now)).toBeUndefined();
    expect(todayOf(makeTrip("b", ["2026-10-18", "2026-10-19"]), now)).toBeUndefined();
  });

  it("finds today's day", () => {
    const t = todayOf(makeTrip("c", ["2026-10-19", "2026-10-20", "2026-10-21"]), now);
    expect(t?.day.dayNumber).toBe(2);
  });

  it("picks the next stop by start time", () => {
    const stops = [
      [],
      [stop("Breakfast", 9 * 60), stop("Museum", 14 * 60), stop("Dinner", 20 * 60)],
    ];
    const t = todayOf(makeTrip("d", ["2026-10-19", "2026-10-20"], stops), now);
    expect(t?.next?.name).toBe("Museum");
  });

  it("falls back to the first stop when none is still ahead", () => {
    const stops = [[stop("Breakfast", 9 * 60), stop("Lunch", 12 * 60)]];
    const t = todayOf(makeTrip("e", ["2026-10-20"], stops), now);
    expect(t?.next?.name).toBe("Breakfast");
  });

  it("has no next stop on a day without stops", () => {
    expect(todayOf(makeTrip("f", ["2026-10-20"]), now)?.next).toBeUndefined();
  });
});

describe("pickToday", () => {
  it("takes the latest-starting trip when two cover today", () => {
    const long = makeTrip("long", ["2026-10-15", "2026-10-20", "2026-10-25"]);
    const short = makeTrip("short", ["2026-10-20", "2026-10-21"]);
    expect(pickToday([long, short], now)?.trip.id).toBe("short");
  });

  it("is undefined with no trip today", () => {
    expect(pickToday([makeTrip("x", ["2026-11-01"])], now)).toBeUndefined();
  });
});
