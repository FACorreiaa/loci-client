import { describe, expect, it } from "vitest";
import { applyCityEvent, applyStopEvent, stopsFromRoute } from "./multi-city";
import type { RouteInfo } from "./chatStream";

const route: RouteInfo = {
  stops: [
    { index: 0, cityName: "Lisbon", sessionId: "s0", dayNumbers: [1, 2] },
    { index: 1, cityName: "Porto", sessionId: "s1", dayNumbers: [3] },
  ],
  legs: [],
  outline: "",
  warnings: [],
  dropped: [],
  totalTravelMins: 0,
};

describe("multi-city projection", () => {
  it("routes a tagged event to its city only", () => {
    let stops = stopsFromRoute(route);
    stops = applyStopEvent(
      stops,
      {
        kind: "general_pois",
        pois: [{ id: "p1", name: "Ribeira" } as any],
        sessionId: "s1",
        stopIndex: 1,
      },
      true,
    );
    expect(stops[0].data).toBeNull();
    expect((stops[1].data as any)?.points_of_interest?.[0].name).toBe("Ribeira");
  });

  it("a city's error marks that city, not the others", () => {
    let stops = stopsFromRoute(route);
    stops = applyStopEvent(
      stops,
      {
        kind: "error",
        userMessage: "Porto failed",
        internalCode: "x",
        retryable: true,
        stopIndex: 1,
      },
      true,
    );
    expect(stops[1].error).toBe("Porto failed");
    expect(stops[1].done).toBe(true);
    expect(stops[0].error).toBeUndefined();
  });

  it("the second ROUTE (with tripId) keeps what each city already has", () => {
    let stops = stopsFromRoute(route);
    stops = applyStopEvent(
      stops,
      {
        kind: "general_pois",
        pois: [{ id: "p1", name: "Belém" } as any],
        sessionId: "s0",
        stopIndex: 0,
      },
      true,
    );
    const again = stopsFromRoute({ ...route, tripId: "t1" }, stops);
    expect((again[0].data as any)?.points_of_interest?.[0].name).toBe("Belém");
  });

  it("applyCityEvent matches the single-city projection", () => {
    const d = applyCityEvent(
      null,
      { kind: "city_data", city: { city: "Lisbon" } as any, sessionId: "s0" },
      true,
      "s0",
    );
    expect((d as any)?.general_city_data?.city).toBe("Lisbon");
    expect((d as any)?.session_id).toBe("s0");
    const h = applyCityEvent(
      null,
      { kind: "hotels", pois: [{ name: "Inn" } as any], sessionId: "", city: undefined },
      true,
      "s9",
    );
    expect((h as any).hotels[0].name).toBe("Inn");
    expect((h as any).session_id).toBe("s9");
  });

  it("untagged events are ignored by applyStopEvent", () => {
    const stops = stopsFromRoute(route);
    expect(applyStopEvent(stops, { kind: "progress", stage: "x" }, true)).toBe(stops);
  });
});

describe("gastronomy projection", () => {
  const gastronomy = {
    city_name: "Porto",
    country: "Portugal",
    overview: "",
    culinary_traditions: [],
    dining_tips: [],
    dishes: [
      {
        name: "Francesinha",
        local_name: "",
        description: "",
        category: "main" as const,
        is_signature: true,
        tags: [],
        places: [],
      },
    ],
  };

  it("merges beside what the city already has rather than replacing it", () => {
    const before = { general_city_data: { city: "Porto" }, session_id: "s1" } as any;
    const after = applyCityEvent(
      before,
      { kind: "gastronomy", gastronomy, sessionId: "s1" },
      true,
      "s1",
    ) as any;
    expect(after.general_city_data.city).toBe("Porto");
    expect(after.gastronomy.dishes[0].name).toBe("Francesinha");
  });

  it("is the whole answer of a gastronomy search", () => {
    const after = applyCityEvent(
      null,
      { kind: "gastronomy", gastronomy, sessionId: "s9" },
      false,
      "s9",
    ) as any;
    expect(after).toMatchObject({ gastronomy, session_id: "s9" });
  });
});
