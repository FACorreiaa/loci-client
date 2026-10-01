import { describe, expect, it, vi } from "vitest";
vi.mock("../connect-transport", () => ({ transport: {} }));
import { create } from "@bufbuild/protobuf";
import {
  FlightCabin,
  TripDraftSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { mapTrip } from "./trips";
import { cabinFromName, cityCoords, hotelsWithStars, starsOf } from "./trip-plan";

describe("mapTrip plan fields", () => {
  it("maps dates, stays and flights", () => {
    const t = mapTrip(
      create(TripDraftSchema, {
        id: "t1",
        title: "Lisbon",
        cityName: "Lisbon",
        version: 3n,
        startDate: "2026-11-12",
        endDate: "2026-11-15",
        stays: [
          {
            cityName: "Lisbon",
            name: "Hotel Avenida",
            starRating: "4",
            bookingUrl: "https://a.example",
          },
        ],
        flights: [
          {
            id: "f1",
            origin: { name: "New York", iata: "JFK" },
            destination: { name: "Lisbon" },
            departDate: "2026-11-12",
            passengers: 2,
            cabin: FlightCabin.BUSINESS,
            links: [
              { provider: "google_flights", label: "Google Flights", url: "https://g.example" },
            ],
          },
        ],
      }),
    );
    expect(t.startDate).toBe("2026-11-12");
    expect(t.endDate).toBe("2026-11-15");
    expect(t.stays[0]).toMatchObject({
      cityName: "Lisbon",
      name: "Hotel Avenida",
      starRating: "4",
    });
    expect(t.flights[0]).toMatchObject({
      id: "f1",
      origin: { name: "New York", iata: "JFK" },
      destination: { name: "Lisbon" },
      passengers: 2,
      cabin: "business",
    });
    expect(t.flights[0].destination.iata).toBeUndefined();
    expect(t.flights[0].links[0].url).toBe("https://g.example");
  });

  it("an older trip has empty plan fields", () => {
    const t = mapTrip(create(TripDraftSchema, { id: "t1", title: "x", version: 1n }));
    expect(t.startDate).toBeUndefined();
    expect(t.stays).toEqual([]);
    expect(t.flights).toEqual([]);
  });
});

describe("stars", () => {
  it("reads numbers before glyphs", () => {
    expect(starsOf("4")).toBe(4);
    expect(starsOf("4.5")).toBe(4.5);
    expect(starsOf("4★")).toBe(4);
    expect(starsOf("★★★")).toBe(3);
    expect(starsOf(4)).toBe(4);
    expect(starsOf("")).toBeUndefined();
    expect(starsOf(undefined)).toBeUndefined();
  });

  it("filters to the whole-star band; any keeps unrated", () => {
    const hotels = [
      { name: "A", star_rating: 5, rating: 4.8 },
      { name: "B", star_rating: 4.5, rating: 4.2 },
      { name: "C", star_rating: undefined, rating: 4.9 },
      { name: "D", star_rating: 3, rating: 4.0 },
    ] as any[];
    expect(hotelsWithStars(hotels, 4).map((h) => h.name)).toEqual(["B"]);
    expect(hotelsWithStars(hotels, 0).map((h) => h.name)).toEqual(["C", "A", "B", "D"]);
  });
});

describe("cityCoords", () => {
  it("takes the first day in that city that has coordinates", () => {
    const trip = {
      cityName: "Lisbon",
      days: [
        { cityName: "Lisbon" },
        { cityName: "Porto", cityLat: 41.1, cityLon: -8.6 },
        { cityName: "", cityLat: 38.7, cityLon: -9.1 },
      ],
    } as any;
    expect(cityCoords(trip, "Porto")).toEqual({ lat: 41.1, lon: -8.6 });
    expect(cityCoords(trip, "lisbon")).toEqual({ lat: 38.7, lon: -9.1 });
    expect(cityCoords(trip, "Faro")).toBeUndefined();
  });
});

describe("cabin", () => {
  it("maps names to the proto enum", () => {
    expect(cabinFromName("business")).toBe(FlightCabin.BUSINESS);
    expect(cabinFromName(undefined)).toBe(FlightCabin.UNSPECIFIED);
  });
});
