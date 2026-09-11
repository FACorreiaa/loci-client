import { describe, expect, it } from "vitest";
import {
  buildAppleMapsUrl,
  buildGoogleMapsMultiStopUrl,
  buildGoogleMapsUrl,
  buildItineraryIcs,
  groupStopsByDay,
  lockedDayCount,
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
