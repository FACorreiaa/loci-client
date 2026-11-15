import { describe, expect, it } from "vitest";
import { stopsFromCityResponse } from "./createItineraryStream";

const place = (name: string) => ({ id: name, name, latitude: 1, longitude: 1 }) as any;

describe("stopsFromCityResponse", () => {
  it("uses the itinerary's places when it has them", () => {
    const { stops } = stopsFromCityResponse({
      itinerary_response: { points_of_interest: [place("Planned")] },
      points_of_interest: [place("City A"), place("City B")],
    } as any);
    expect(stops.map((s) => s.name)).toEqual(["Planned"]);
  });

  // The itinerary part of a generation can fail while the city's places and
  // the trip saved from them succeed. The session then carries an itinerary
  // with an empty list, and the page used to say nothing had been saved.
  it("falls back to the city's places when the itinerary's list is empty", () => {
    const { stops } = stopsFromCityResponse({
      itinerary_response: { points_of_interest: [] },
      points_of_interest: [place("City A"), place("City B")],
    } as any);
    expect(stops.map((s) => s.name)).toEqual(["City A", "City B"]);
  });

  it("has no stops when there is nothing at all", () => {
    expect(stopsFromCityResponse(null).stops).toEqual([]);
  });
});
