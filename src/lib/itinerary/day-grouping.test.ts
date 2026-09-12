import { describe, it, expect } from "vitest";

import { groupStopsByDay, unlockedStops, lockedDayCount } from "@/lib/trip-kit";
import { stopsFromCityResponse } from "@/lib/itinerary/createItineraryStream";
import type { AiCityResponse, POIDetailedInfo } from "@/lib/api/types";

const poi = (name: string, over: Partial<POIDetailedInfo> = {}): POIDetailedInfo =>
  ({
    id: `id-${name}`,
    city: "Funchal",
    name,
    latitude: 32.65,
    longitude: -16.91,
    category: "Viewpoint",
    ...over,
  }) as POIDetailedInfo;

const cityResponse = (pois: POIDetailedInfo[]): AiCityResponse =>
  ({
    points_of_interest: [],
    itinerary_response: {
      itinerary_name: "Four days in Madeira",
      overall_description: "",
      points_of_interest: pois,
    },
  }) as unknown as AiCityResponse;

describe("the day a stop belongs to", () => {
  // The wire field is 1-based; trip-kit is 0-based and labels `Day ${day + 1}`.
  // Converting once, at this adapter, is what keeps the free-tier gate — which
  // unlocks day 0 — working untouched.
  it("converts the server's 1-based day to trip-kit's 0-based one", () => {
    const { stops } = stopsFromCityResponse(
      cityResponse([poi("Pico do Arieiro", { day: 1 }), poi("Câmara de Lobos", { day: 2 })]),
    );

    expect(stops.map((s) => s.day)).toEqual([0, 1]);
    expect(groupStopsByDay(stops).map((d) => d.label)).toEqual(["Day 1", "Day 2"]);
  });

  it("leaves the day undefined when the server did not say", () => {
    const { stops } = stopsFromCityResponse(cityResponse([poi("Blandy's Wine Lodge")]));
    expect(stops[0].day).toBeUndefined();
  });

  // Sorting on priority alone interleaves the day groups, so day two's best
  // place lands above day one's second-best and the headers read as nonsense.
  it("orders by day first and priority within the day", () => {
    const { stops } = stopsFromCityResponse(
      cityResponse([
        poi("Day two, best", { day: 2, priority: 1 }),
        poi("Day one, worst", { day: 1, priority: 9 }),
        poi("Day one, best", { day: 1, priority: 1 }),
      ]),
    );

    expect(stops.map((s) => s.name)).toEqual(["Day one, best", "Day one, worst", "Day two, best"]);
  });
});

describe("groupStopsByDay", () => {
  // The whole point of the change: a four-day trip renders as four days, not
  // as ceil(places / 4). Twenty-four places used to become six days.
  it("honours explicit days rather than chunking by count", () => {
    const stops = Array.from({ length: 24 }, (_, i) => ({
      name: `Place ${i}`,
      day: Math.floor(i / 6),
    }));

    const days = groupStopsByDay(stops, 4);

    expect(days).toHaveLength(4);
    expect(days.every((d) => d.stops.length === 6)).toBe(true);
  });

  it("chunks by index only when no stop carries a day", () => {
    const stops = Array.from({ length: 9 }, (_, i) => ({ name: `Place ${i}` }));
    const days = groupStopsByDay(stops, 4);

    expect(days.map((d) => d.stops.length)).toEqual([4, 4, 1]);
    expect(days.map((d) => d.label)).toEqual(["Day 1", "Day 2", "Day 3"]);
  });

  it("treats a partly numbered list as numbered, grouping the rest under day one", () => {
    const days = groupStopsByDay([{ name: "A", day: 0 }, { name: "B" }, { name: "C", day: 1 }], 4);

    expect(days.map((d) => d.day)).toEqual([0, 1]);
    expect(days[0].stops.map((s) => s.name)).toEqual(["A", "B"]);
  });

  it("keeps the extra fields of whatever it was given", () => {
    const [day] = groupStopsByDay([{ name: "A", day: 0, key: "k", enriched: true }]);
    expect(day.stops[0]).toMatchObject({ key: "k", enriched: true });
  });

  it("is empty for no stops", () => {
    expect(groupStopsByDay([])).toEqual([]);
  });
});

// The free tier unlocks day 0. Explicit days must not change that, or a free
// account silently gains or loses a day's worth of places.
describe("the free-tier day gate", () => {
  const stops = [
    { name: "A", day: 0 },
    { name: "B", day: 0 },
    { name: "C", day: 1 },
    { name: "D", day: 2 },
  ];

  it("gives a free account the first day only", () => {
    expect(unlockedStops({ stops, isPro: false } as never).map((s) => s.name)).toEqual(["A", "B"]);
    expect(lockedDayCount({ stops, isPro: false } as never)).toBe(2);
  });

  it("gives a Pro account everything", () => {
    expect(unlockedStops({ stops, isPro: true } as never)).toHaveLength(4);
    expect(lockedDayCount({ stops, isPro: true } as never)).toBe(0);
  });
});
