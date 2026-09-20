import { describe, expect, it } from "vitest";
import { TripPace } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import type { Trip } from "~/lib/api/trips";
import {
  dateKey,
  monthCells,
  pinTripDates,
  tripBlocksOnCalendar,
  unscheduledTrips,
} from "./trip-calendar";

const trip = (partial: Partial<Trip> & Pick<Trip, "id" | "title">): Trip => ({
  userId: "u1",
  cityName: "Lisbon",
  constraints: { pace: TripPace.UNSPECIFIED, interests: [] },
  days: [],
  version: 1n,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...partial,
});

describe("dateKey", () => {
  it("uses the local calendar day, not UTC", () => {
    expect(dateKey(new Date(2026, 9, 8))).toBe("2026-10-08");
  });
});

describe("tripBlocksOnCalendar", () => {
  it("emits one block per dated day", () => {
    const blocks = tripBlocksOnCalendar([
      trip({
        id: "t1",
        title: "Lisbon weekend",
        days: [
          { id: "d1", dayNumber: 1, date: "2026-10-08", stops: [] },
          { id: "d2", dayNumber: 2, date: "2026-10-09", stops: [] },
        ],
      }),
    ]);
    expect(blocks.map((b) => b.dateKey)).toEqual(["2026-10-08", "2026-10-09"]);
    expect(blocks[0]).toMatchObject({ tripId: "t1", title: "Lisbon weekend", dayNumber: 1 });
  });

  it("skips days without a date", () => {
    const blocks = tripBlocksOnCalendar([
      trip({
        id: "t1",
        title: "Undated",
        days: [{ id: "d1", dayNumber: 1, stops: [] }],
      }),
    ]);
    expect(blocks).toEqual([]);
  });
});

describe("unscheduledTrips", () => {
  it("lists trips that have no dated days", () => {
    const dated = trip({
      id: "a",
      title: "Dated",
      days: [{ id: "d1", dayNumber: 1, date: "2026-10-08", stops: [] }],
    });
    const open = trip({
      id: "b",
      title: "Open",
      days: [{ id: "d1", dayNumber: 1, stops: [] }],
    });
    expect(unscheduledTrips([dated, open]).map((t) => t.id)).toEqual(["b"]);
  });
});

describe("monthCells", () => {
  it("pads October 2026 to full weeks starting Monday", () => {
    const cells = monthCells(2026, 9);
    expect(cells[0]).toEqual({ dateKey: "2026-09-28", inMonth: false, day: 28 });
    expect(cells.find((c) => c.dateKey === "2026-10-01")).toEqual({
      dateKey: "2026-10-01",
      inMonth: true,
      day: 1,
    });
    expect(cells.length % 7).toBe(0);
    expect(cells.at(-1)?.dateKey).toBe("2026-11-01");
  });
});

describe("pinTripDates", () => {
  it("stamps consecutive local dates from the start day", () => {
    const pinned = pinTripDates(
      trip({
        id: "t1",
        title: "Porto",
        days: [
          { id: "d1", dayNumber: 1, stops: [] },
          { id: "d2", dayNumber: 3, stops: [] },
          { id: "d3", dayNumber: 2, stops: [] },
        ],
      }),
      new Date(2026, 9, 8),
    );
    expect(pinned.days.map((d) => d.date)).toEqual(["2026-10-08", "2026-10-10", "2026-10-09"]);
  });
});
