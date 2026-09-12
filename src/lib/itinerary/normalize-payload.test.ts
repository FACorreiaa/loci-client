import { describe, expect, it } from "vitest";
import { hasItineraryContent, normalizeItineraryPayload } from "./normalize-payload";

/**
 * The shape mapAiCityResponse actually returns for a live `itinerary` event:
 * city data and the general POI list at the top level, and an
 * AIItineraryResponse — which has a points_of_interest array of its own — under
 * itinerary_response.
 */
const liveItineraryPayload = () => ({
  general_city_data: {
    city: "Funchal",
    country: "Portugal",
    description: "Funchal is the capital of Madeira.",
    population: "111,892",
    area: "76.15 km²",
    language: "Portuguese",
    weather: "Subtropical",
    center_latitude: 32.65,
    center_longitude: -16.91,
  },
  points_of_interest: [{ name: "Mercado dos Lavradores" }],
  itinerary_response: {
    itinerary_name: "Four days in Funchal",
    overall_description: "Old town, the levadas, and a day in the mountains.",
    points_of_interest: [{ name: "Sé do Funchal" }, { name: "Monte Palace" }],
    restaurants: [],
    bars: [],
  },
  session_id: "cb73a088-0dca-4c75-bc5f-cadc88be3334",
});

describe("normalizeItineraryPayload", () => {
  // The bug that emptied the page: the unwrap branch keyed on
  // itinerary_response.points_of_interest, which is a legitimate field of every
  // AIItineraryResponse rather than a marker of a doubly-wrapped payload. So it
  // fired on the ordinary shape and rebuilt the object from the inner one,
  // which has no general_city_data — taking the city header with it.
  it("keeps the city data on an ordinary live payload", () => {
    const out = normalizeItineraryPayload(liveItineraryPayload());
    expect(out.general_city_data?.city).toBe("Funchal");
    expect(out.general_city_data?.population).toBe("111,892");
  });

  // Same cause, and why the title and summary above the stops went blank.
  it("keeps the itinerary response on an ordinary live payload", () => {
    const out = normalizeItineraryPayload(liveItineraryPayload());
    expect(out.itinerary_response?.itinerary_name).toBe("Four days in Funchal");
    expect(out.itinerary_response?.points_of_interest).toHaveLength(2);
  });

  it("keeps the general POI list", () => {
    const out = normalizeItineraryPayload(liveItineraryPayload());
    expect(out.points_of_interest).toHaveLength(1);
  });

  // The shape the unwrap was actually written for: the server has been seen to
  // answer with the whole payload nested one level down.
  it("unwraps a genuinely double-wrapped payload", () => {
    const inner = liveItineraryPayload();
    const out = normalizeItineraryPayload({ itinerary_response: inner, session_id: "outer" });
    expect(out.general_city_data?.city).toBe("Funchal");
    expect(out.itinerary_response?.itinerary_name).toBe("Four days in Funchal");
    expect(out.points_of_interest).toHaveLength(1);
  });

  it("rejects a payload with nothing to show", () => {
    expect(normalizeItineraryPayload({})).toBeNull();
    expect(normalizeItineraryPayload(null)).toBeNull();
  });
});

describe("hasItineraryContent", () => {
  it("accepts a payload that only has city data", () => {
    expect(hasItineraryContent({ general_city_data: { city: "Funchal" } })).toBe(true);
  });

  it("rejects an empty object", () => {
    expect(hasItineraryContent({})).toBe(false);
  });
});
