import { describe, expect, it } from "vitest";
import {
  allDaysTimeline,
  formatLeg,
  formatStopsParam,
  parseStopsParam,
  stopChipLabel,
} from "./multi-city-view";

describe("multi-city view helpers", () => {
  it("parses and formats the stops param", () => {
    expect(parseStopsParam("Lisbon:3,Porto:2,São Paulo")).toEqual([
      { cityName: "Lisbon", nights: 3 },
      { cityName: "Porto", nights: 2 },
      { cityName: "São Paulo", nights: undefined },
    ]);
    expect(parseStopsParam(undefined)).toEqual([]);
    expect(parseStopsParam("a,b,c,d,e,f")).toHaveLength(5);
    expect(formatStopsParam([{ cityName: "Lisbon", nights: 3 }, { cityName: "Porto" }])).toBe(
      "Lisbon:3,Porto",
    );
  });

  it("labels chips and legs", () => {
    expect(
      stopChipLabel({
        index: 0,
        cityName: "Lisbon",
        sessionId: "s",
        dayNumbers: [1, 2],
        data: null,
        done: false,
      }),
    ).toBe("Lisbon · 2n");
    expect(
      formatLeg({
        afterDay: 2,
        fromName: "Lisbon",
        toName: "Porto",
        distanceKm: 274.4,
        durationMins: 194,
        mode: "train",
      }),
    ).toBe("Train · ≈3h14 · 274 km");
    expect(
      formatLeg({
        afterDay: 1,
        fromName: "A",
        toName: "B",
        distanceKm: 40,
        durationMins: 30,
        mode: "drive",
      }),
    ).toBe("Drive · ≈30 min · 40 km");
  });

  it("interleaves days and legs in trip order", () => {
    const items = allDaysTimeline(
      [
        {
          index: 0,
          cityName: "Lisbon",
          sessionId: "s0",
          dayNumbers: [1, 2],
          done: true,
          data: {
            itinerary_response: {
              points_of_interest: [
                { name: "Belém", day: 1 },
                { name: "Alfama", day: 2 },
              ],
            },
          } as any,
        },
        {
          index: 1,
          cityName: "Porto",
          sessionId: "s1",
          dayNumbers: [3],
          done: true,
          data: {
            itinerary_response: { points_of_interest: [{ name: "Ribeira", day: 1 }] },
          } as any,
        },
      ],
      [
        {
          afterDay: 2,
          fromName: "Lisbon",
          toName: "Porto",
          distanceKm: 274,
          durationMins: 194,
          mode: "train",
        },
      ],
    );
    expect(items.map((i) => (i.kind === "day" ? `${i.cityName}${i.day}` : "leg"))).toEqual([
      "Lisbon1",
      "Lisbon2",
      "leg",
      "Porto3",
    ]);
    const porto = items[3];
    expect(porto.kind === "day" && porto.pois[0].name).toBe("Ribeira");
  });
});

import { mapView, mergedResponse, tripWideResponse } from "./multi-city-view";

describe("multi-city data for the existing views", () => {
  const lisbon = {
    index: 0,
    cityName: "Lisbon",
    sessionId: "s0",
    dayNumbers: [1, 2],
    done: true,
    data: {
      general_city_data: { city: "Lisbon" },
      itinerary_response: {
        itinerary_name: "L",
        points_of_interest: [
          { name: "Belém", day: 1 },
          { name: "Alfama", day: 2 },
        ],
      },
    } as any,
  };
  const porto = {
    index: 1,
    cityName: "Porto",
    sessionId: "s1",
    dayNumbers: [3],
    done: true,
    data: { itinerary_response: { points_of_interest: [{ name: "Ribeira", day: 1 }] } } as any,
  };

  it("renumbers a city's days to trip days", () => {
    const r = tripWideResponse(porto) as any;
    expect(r.itinerary_response.points_of_interest[0].day).toBe(3);
    expect((porto.data as any).itinerary_response.points_of_interest[0].day).toBe(1);
  });

  it("merges every city into one response for the map", () => {
    const r = mergedResponse([lisbon, porto]) as any;
    expect(r.itinerary_response.points_of_interest.map((p: any) => `${p.name}${p.day}`)).toEqual([
      "Belém1",
      "Alfama2",
      "Ribeira3",
    ]);
    expect(r.general_city_data.city).toBe("Lisbon");
  });

  it("frames all the points on the map", () => {
    const one = mapView([{ latitude: 38.7, longitude: -9.1 }]);
    expect(one.zoom).toBe(12);
    const two = mapView([
      { latitude: 38.7, longitude: -9.1 },
      { latitude: 41.1, longitude: -8.6 },
    ]);
    expect(two.center[0]).toBeCloseTo(-8.85, 1);
    expect(two.center[1]).toBeCloseTo(39.9, 1);
    expect(two.zoom).toBeLessThan(9);
    expect(mapView([]).zoom).toBe(12);
  });
});

import { isMultiPayload, multiShareText, routeFromTrip } from "./multi-city-view";

describe("saving and reopening a multi-city trip", () => {
  it("share text groups by city, then day, and credits Loci", () => {
    const text = multiShareText(
      {
        stops: [],
        legs: [
          {
            afterDay: 1,
            fromName: "Lisbon",
            toName: "Porto",
            distanceKm: 274,
            durationMins: 194,
            mode: "train",
          },
        ],
        outline: "Lisbon (1 day) → Porto (1 day)",
        warnings: [],
        dropped: [],
        totalTravelMins: 194,
      },
      [
        {
          index: 0,
          cityName: "Lisbon",
          sessionId: "s0",
          dayNumbers: [1],
          done: true,
          data: { itinerary_response: { points_of_interest: [{ name: "Belém", day: 1 }] } } as any,
        },
        {
          index: 1,
          cityName: "Porto",
          sessionId: "s1",
          dayNumbers: [2],
          done: true,
          data: {
            itinerary_response: { points_of_interest: [{ name: "Ribeira", day: 1 }] },
          } as any,
        },
      ],
    );
    expect(text).toMatch(/^Lisbon \(1 day\) → Porto \(1 day\)/);
    expect(text.indexOf("\nLisbon\n")).toBeGreaterThan(-1);
    expect(text.indexOf("Train")).toBeLessThan(text.indexOf("\nPorto\n"));
    expect(text).toContain("Day 2 — Ribeira");
    expect(text.trim().endsWith("Generated from Loci")).toBe(true);
  });

  it("rebuilds the route from a saved trip", () => {
    const { route, stops } = routeFromTrip({
      title: "Lisbon + Porto",
      cities: [
        { cityName: "Lisbon", sessionId: "s0", nights: 2, orderIndex: 0 },
        { cityName: "Porto", sessionId: "s1", nights: 1, orderIndex: 1 },
      ],
      days: [
        { dayNumber: 1, cityName: "Lisbon" },
        { dayNumber: 2, cityName: "Lisbon" },
        { dayNumber: 3, cityName: "Porto" },
      ],
      legs: [
        {
          afterDay: 2,
          fromName: "Lisbon",
          toName: "Porto",
          distanceKm: 274,
          durationMins: 194,
          mode: "train",
        },
      ],
    } as any);
    expect(stops.map((s) => `${s.cityName}:${s.dayNumbers.join("")}:${s.sessionId}`)).toEqual([
      "Lisbon:12:s0",
      "Porto:3:s1",
    ]);
    expect(route.legs[0].mode).toBe("train");
    expect(route.outline).toBe("Lisbon + Porto");
  });

  it("recognises a multi-city offline copy", () => {
    expect(isMultiPayload({ kind: "multi", route: {} as any, stops: [] })).toBe(true);
    expect(isMultiPayload({ itinerary_response: {} })).toBe(false);
    expect(isMultiPayload(null)).toBe(false);
  });
});
