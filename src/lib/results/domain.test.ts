import { describe, expect, it } from "vitest";
import type { POIDetailedInfo } from "~/lib/api/types";
import {
  favoritePayload,
  hasDomainResults,
  isOpenNow,
  listTitle,
  todayHours,
  unwrapDomainResults,
} from "./domain";

const poi = (over: Partial<POIDetailedInfo>): POIDetailedInfo => ({
  id: "11111111-1111-4111-8111-111111111111",
  city: "Rome",
  name: "Hotel Artemide",
  latitude: 41.9,
  longitude: 12.5,
  category: "Hotel",
  rating: 4.5,
  ...over,
});

const city = { city: "Rome", country: "Italy" } as any;

describe("unwrapDomainResults", () => {
  it("reads a top-level domain list (stream event / restored session)", () => {
    const out = unwrapDomainResults({ hotels: [poi({})], general_city_data: city }, "hotels");
    expect(out?.list.map((p) => p.name)).toEqual(["Hotel Artemide"]);
    expect(out?.city?.city).toBe("Rome");
    expect(out?.extras).toEqual([]);
  });

  it("reads the older domain envelope, including its city", () => {
    const out = unwrapDomainResults(
      { dining_response: { restaurants: [poi({ name: "Roscioli" })], general_city_data: city } },
      "restaurants",
    );
    expect(out?.list[0].name).toBe("Roscioli");
    expect(out?.city?.city).toBe("Rome");
  });

  it("reads activities_response, which the old page never did", () => {
    const out = unwrapDomainResults(
      { activities_response: { activities: [poi({ name: "Colosseum" })] } },
      "activities",
    );
    expect(out?.list[0].name).toBe("Colosseum");
  });

  it("falls back to points_of_interest when there is no domain list", () => {
    const out = unwrapDomainResults({ points_of_interest: [poi({ name: "A" })] }, "hotels");
    expect(out?.list.map((p) => p.name)).toEqual(["A"]);
    expect(out?.extras).toEqual([]);
  });

  it("keeps top-level places outside the list as extras, deduplicated by id", () => {
    const inList = poi({ name: "In list" });
    const extra = poi({ id: "22222222-2222-4222-8222-222222222222", name: "Nearby" });
    const out = unwrapDomainResults(
      { hotels: [inList], points_of_interest: [inList, extra] },
      "hotels",
    );
    expect(out?.list).toHaveLength(1);
    expect(out?.extras.map((p) => p.name)).toEqual(["Nearby"]);
  });

  it("rejects an empty object and null", () => {
    expect(unwrapDomainResults({}, "hotels")).toBeNull();
    expect(unwrapDomainResults(null, "hotels")).toBeNull();
    expect(hasDomainResults({ hotels: [] }, "hotels")).toBe(false);
  });

  it("accepts city data on its own", () => {
    const out = unwrapDomainResults({ general_city_data: city }, "restaurants");
    expect(out?.list).toEqual([]);
    expect(out?.city?.city).toBe("Rome");
  });

  it("carries the session id from either level", () => {
    expect(unwrapDomainResults({ session_id: "s1", hotels: [poi({})] }, "hotels")?.sessionId).toBe(
      "s1",
    );
    expect(
      unwrapDomainResults(
        { accommodation_response: { session_id: "s2", hotels: [poi({})] } },
        "hotels",
      )?.sessionId,
    ).toBe("s2");
  });
});

describe("favoritePayload", () => {
  it("saves under the place's id, not its name, with the domain's content type", () => {
    const item = favoritePayload(poi({}), "hotels", "Rome");
    expect(item.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(item.name).toBe("Hotel Artemide");
    expect(item.contentType).toBe("hotel");
    expect(item.cityName).toBe("Rome");
    expect(item.latitude).toBe(41.9);
    expect(item.rating).toBe(4.5);
  });

  it("maps restaurants and activities to their content types", () => {
    expect(favoritePayload(poi({}), "restaurants").contentType).toBe("restaurant");
    expect(favoritePayload(poi({}), "activities").contentType).toBe("poi");
  });

  it("prefers the place's own city and falls back to the page's", () => {
    expect(favoritePayload(poi({ city: "" }), "hotels", "Lisbon").cityName).toBe("Lisbon");
    expect(favoritePayload(poi({ city: "Porto" }), "hotels", "Lisbon").cityName).toBe("Porto");
  });

  it("omits a zero rating rather than saving it as a rating", () => {
    expect(favoritePayload(poi({ rating: 0 }), "hotels").rating).toBeUndefined();
  });
});

describe("listTitle", () => {
  it("names the city when known", () => {
    expect(listTitle("hotels", "Rome")).toBe("Hotels in Rome");
    expect(listTitle("restaurants", " ")).toBe("Restaurants");
    expect(listTitle("activities")).toBe("Activities");
  });
});

describe("todayHours", () => {
  const wednesday = new Date(2026, 8, 23, 12, 0); // 2026-09-23 is a Wednesday

  it("picks today's line out of a JSON weekday map", () => {
    const raw = JSON.stringify({ Monday: "9-5", Wednesday: "10:00-22:00", Sunday: "Closed" });
    expect(todayHours(raw, wednesday)).toBe("10:00-22:00");
  });

  it("accepts three-letter days and an object", () => {
    expect(todayHours({ wed: "11:00 AM - 11:00 PM" }, wednesday)).toBe("11:00 AM - 11:00 PM");
  });

  it("returns a plain string as-is and nothing for an empty one", () => {
    expect(todayHours("Daily 9am-6pm", wednesday)).toBe("Daily 9am-6pm");
    expect(todayHours("", wednesday)).toBeUndefined();
    expect(todayHours(undefined, wednesday)).toBeUndefined();
  });

  it("uses a single unnamed line for every day", () => {
    expect(todayHours({ daily: "08:00-20:00" }, wednesday)).toBe("08:00-20:00");
  });

  it("returns nothing when today is simply not listed", () => {
    expect(todayHours({ Monday: "9-5", Tuesday: "9-5" }, wednesday)).toBeUndefined();
  });
});

describe("isOpenNow", () => {
  const at = (h: number, m = 0) => new Date(2026, 8, 23, h, m);

  it("is undefined when hours are unknown, never Closed", () => {
    expect(isOpenNow(undefined, at(12))).toBeUndefined();
    expect(isOpenNow("", at(12))).toBeUndefined();
    expect(isOpenNow("by appointment", at(12))).toBeUndefined();
  });

  it("reads 24h and 12h ranges", () => {
    expect(isOpenNow("10:00-22:00", at(12))).toBe(true);
    expect(isOpenNow("10:00-22:00", at(23))).toBe(false);
    expect(isOpenNow("9:00 AM – 10:00 PM", at(21, 59))).toBe(true);
    expect(isOpenNow("9:00 AM – 10:00 PM", at(8))).toBe(false);
  });

  it("handles closing after midnight", () => {
    expect(isOpenNow("6 PM - 2 AM", at(1))).toBe(true);
    expect(isOpenNow("6 PM - 2 AM", at(15))).toBe(false);
  });

  it("reads Closed and 24 hours", () => {
    expect(isOpenNow("Closed", at(12))).toBe(false);
    expect(isOpenNow("Open 24 hours", at(3))).toBe(true);
  });
});

import { stopResults } from "./domain";

describe("stopResults", () => {
  it("unwraps the active city's list", () => {
    const stops = [
      {
        index: 0,
        cityName: "Lisbon",
        sessionId: "s0",
        dayNumbers: [1],
        done: true,
        data: { hotels: [{ id: "h1", name: "Lisbon Inn" }] } as any,
      },
      {
        index: 1,
        cityName: "Porto",
        sessionId: "s1",
        dayNumbers: [2],
        done: true,
        data: { hotels: [{ id: "h2", name: "Porto Inn" }] } as any,
      },
    ];
    expect(stopResults(stops, 1, "hotels")?.list[0]?.name).toBe("Porto Inn");
    expect(stopResults(stops, 7, "hotels")).toBeNull();
    expect(stopResults(undefined, 0, "hotels")).toBeNull();
  });
});
