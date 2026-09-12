import { describe, expect, it } from "vitest";
import {
  buildAppleMapsUrl,
  buildGoogleMapsMultiStopUrl,
  buildGoogleMapsUrl,
  buildItineraryIcs,
  groupStopsByDay,
  lockedDayCount,
  parseLocalDate,
  tripDateRange,
  unlockedStops,
  type TripKitInput,
  type TripStop,
} from "./trip-kit";

const stops: TripStop[] = [
  { name: "A", latitude: 38.7, longitude: -9.1 },
  { name: "B", latitude: 38.71, longitude: -9.12 },
  { name: "C", latitude: 38.72, longitude: -9.13 },
  { name: "D", latitude: 38.73, longitude: -9.14 },
  { name: "E", latitude: 38.74, longitude: -9.15 },
];

describe("groupStopsByDay", () => {
  it("buckets by stopsPerDay", () => {
    const days = groupStopsByDay(stops, 4);
    expect(days).toHaveLength(2);
    expect(days[0].stops).toHaveLength(4);
    expect(days[1].stops).toHaveLength(1);
  });

  it("numbers chunked days from one", () => {
    expect(groupStopsByDay(stops, 4).map((d) => d.label)).toEqual(["Day 1", "Day 2"]);
  });

  // The server numbers days from 1 (verified against a real Madeira itinerary:
  // days 1-4). The label used to be `Day ${day + 1}` on the raw value, which
  // rendered that trip as "Day 2" through "Day 5" with no Day 1 anywhere.
  // Labelling by position is right whichever base the server uses.
  it("numbers server-supplied one-based days from one", () => {
    const withDays: TripStop[] = [
      { name: "A", day: 1 },
      { name: "B", day: 1 },
      { name: "C", day: 2 },
      { name: "D", day: 3 },
      { name: "E", day: 4 },
    ];
    const days = groupStopsByDay(withDays, 4);
    expect(days.map((d) => d.label)).toEqual(["Day 1", "Day 2", "Day 3", "Day 4"]);
    expect(days[0].stops).toHaveLength(2);
  });

  it("numbers server-supplied zero-based days from one too", () => {
    const withDays: TripStop[] = [
      { name: "A", day: 0 },
      { name: "B", day: 1 },
    ];
    expect(groupStopsByDay(withDays, 4).map((d) => d.label)).toEqual(["Day 1", "Day 2"]);
  });

  // Sparse or non-contiguous days must still read as consecutive.
  it("labels sparse days consecutively", () => {
    const withDays: TripStop[] = [
      { name: "A", day: 1 },
      { name: "B", day: 5 },
    ];
    expect(groupStopsByDay(withDays, 4).map((d) => d.label)).toEqual(["Day 1", "Day 2"]);
  });
});

describe("unlockedStops / lockedDayCount", () => {
  const base: TripKitInput = {
    title: "Lisbon",
    cityName: "Lisbon",
    stops,
    stopsPerDay: 4,
    isPro: false,
  };

  it("free unlocks day 1 only", () => {
    expect(unlockedStops(base)).toHaveLength(4);
    expect(lockedDayCount(base)).toBe(1);
  });

  it("pro unlocks all", () => {
    expect(unlockedStops({ ...base, isPro: true })).toHaveLength(5);
    expect(lockedDayCount({ ...base, isPro: true })).toBe(0);
  });
});

describe("buildGoogleMapsMultiStopUrl", () => {
  it("builds multi-stop walking URL", () => {
    const url = buildGoogleMapsMultiStopUrl(stops.slice(0, 3), "Lisbon");
    expect(url).toContain("google.com/maps/dir");
    expect(url).toContain("origin=38.7,-9.1");
    expect(url).toContain("destination=38.72,-9.13");
    expect(url).toContain("waypoints=");
    expect(url).toContain("travelmode=walking");
  });

  it("returns null for empty", () => {
    expect(buildGoogleMapsMultiStopUrl([], "X")).toBeNull();
  });
});

describe("buildItineraryIcs", () => {
  it("emits VEVENT blocks", () => {
    const ics = buildItineraryIcs({
      title: "Lisbon Weekend",
      cityName: "Lisbon",
      stops: stops.slice(0, 2),
      stopsPerDay: 4,
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:A");
    expect(ics).toContain("END:VCALENDAR");
  });
});

describe("single-place map links", () => {
  const place = { latitude: 32.6325, longitude: -17.0015, name: "Cabo Girão" };

  it("builds a Google Maps search link from coordinates", () => {
    const url = buildGoogleMapsUrl(place);
    expect(url).toContain("google.com/maps/search/?api=1");
    expect(url).toContain("query=32.6325,-17.0015");
  });

  it("builds an Apple Maps link carrying the name as the pin label", () => {
    const url = buildAppleMapsUrl(place);
    expect(url).toContain("maps.apple.com/?ll=32.6325,-17.0015");
    expect(url).toContain("q=Cabo%20Gir%C3%A3o");
  });

  it("returns null without usable coordinates, so nothing is rendered", () => {
    expect(buildGoogleMapsUrl({ name: "Somewhere" })).toBeNull();
    expect(buildAppleMapsUrl({ name: "Somewhere" })).toBeNull();
    expect(buildGoogleMapsUrl({ latitude: 0, longitude: 0 })).toBeNull();
    expect(buildAppleMapsUrl({ latitude: 0, longitude: 0 })).toBeNull();
  });
});

/** The date line for a given day index, as it appears in the .ics. */
const dtstarts = (ics: string): string[] =>
  ics
    .split("\n")
    .filter((l) => l.startsWith("DTSTART:"))
    .map((l) => l.slice("DTSTART:".length).trim());

describe("parseLocalDate", () => {
  // `new Date("2026-10-08")` is parsed as midnight UTC, which is the 7th
  // anywhere west of Greenwich. The picker hands over a yyyy-mm-dd string, so
  // this is the difference between the trip starting on the day somebody chose
  // and the day before it.
  it("reads a yyyy-mm-dd string as a local day, not a UTC instant", () => {
    const d = parseLocalDate("2026-10-08", 9);
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(9); // October, 0-based
    expect(d!.getDate()).toBe(8);
    expect(d!.getHours()).toBe(9);
  });

  it("rejects anything that is not a date", () => {
    expect(parseLocalDate("", 9)).toBeNull();
    expect(parseLocalDate("not-a-date", 9)).toBeNull();
    expect(parseLocalDate("2026-13-45", 9)).toBeNull();
  });
});

describe("tripDateRange", () => {
  it("names both ends of the trip", () => {
    const range = tripDateRange(new Date(2026, 9, 8, 9, 0, 0), 4);
    expect(range).toContain("8");
    expect(range).toContain("11");
    expect(range).toContain("Oct");
  });

  it("names a single day once", () => {
    const range = tripDateRange(new Date(2026, 9, 8, 9, 0, 0), 1);
    expect(range).toContain("8");
    expect(range).not.toContain("–");
  });

  it("says nothing when there are no days", () => {
    expect(tripDateRange(new Date(2026, 9, 8), 0)).toBe("");
  });
});

describe("buildItineraryIcs start date", () => {
  // The reported bug: a trip on 8-11 October landed on today's week, because
  // every download used the default and no caller could override it.
  it("starts day 1 on the date it was given", () => {
    const ics = buildItineraryIcs(
      { title: "Funchal", cityName: "Funchal", stops: stops.slice(0, 2), stopsPerDay: 4 },
      { startDate: new Date(2026, 9, 8, 9, 0, 0) },
    );
    expect(dtstarts(ics)[0]).toMatch(/^20261008T/);
  });

  it("puts each later day on the next date", () => {
    const ics = buildItineraryIcs(
      { title: "Funchal", cityName: "Funchal", stops, stopsPerDay: 2 },
      { startDate: new Date(2026, 9, 8, 9, 0, 0) },
    );
    const days = [...new Set(dtstarts(ics).map((d) => d.slice(0, 8)))];
    expect(days).toEqual(["20261008", "20261009", "20261010"]);
  });

  // Rolling over a month boundary is where naive date arithmetic breaks.
  it("crosses the end of a month", () => {
    const ics = buildItineraryIcs(
      { title: "X", cityName: "X", stops: stops.slice(0, 4), stopsPerDay: 1 },
      { startDate: new Date(2026, 9, 30, 9, 0, 0) },
    );
    const days = [...new Set(dtstarts(ics).map((d) => d.slice(0, 8)))];
    expect(days).toEqual(["20261030", "20261031", "20261101", "20261102"]);
  });

  it("still defaults to tomorrow when given no date", () => {
    const ics = buildItineraryIcs({
      title: "X",
      cityName: "X",
      stops: stops.slice(0, 1),
      stopsPerDay: 4,
    });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const expected =
      `${tomorrow.getUTCFullYear()}` +
      `${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}` +
      `${String(tomorrow.getUTCDate()).padStart(2, "0")}`;
    expect(dtstarts(ics)[0].slice(0, 8)).toBe(expected);
  });
});
