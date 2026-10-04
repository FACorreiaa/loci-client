// A trip's plan — dates, a stay per city, flights — written through the
// dedicated TripService RPCs (SaveTrip never touches them), plus the helpers
// the Plan panel needs: hotels near a city filtered by stars, and where a
// city of the trip is.
import { create } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";
import {
  AddFlightRequestSchema,
  BuildFlightLinksRequestSchema,
  ClearStayRequestSchema,
  FlightCabin,
  RemoveFlightRequestSchema,
  SetStayRequestSchema,
  SetTripDatesRequestSchema,
  TripService,
  type TripDraft as ProtoTripDraft,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import {
  FavoritesService,
  GetNearbyHotelsRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { transport } from "../connect-transport";
import { mapProtoToHotel } from "./hotels";
import type { HotelDetailedInfo } from "./types";
import type { FlightCabinName, FlightLink, FlightPlace, Trip, TripStay } from "./trips";

const tripClient = createClient(TripService, transport);
const favoritesClient = createClient(FavoritesService, transport);

/** One flight search, as the Plan panel and AddFlight take it. */
export interface FlightSearch {
  origin: FlightPlace;
  destination: FlightPlace;
  departDate: string;
  returnDate?: string;
  passengers: number;
  cabin?: FlightCabinName;
}

export const cabinFromName = (name: FlightCabinName | undefined): FlightCabin => {
  switch (name) {
    case "economy":
      return FlightCabin.ECONOMY;
    case "premium_economy":
      return FlightCabin.PREMIUM_ECONOMY;
    case "business":
      return FlightCabin.BUSINESS;
    case "first":
      return FlightCabin.FIRST;
    default:
      return FlightCabin.UNSPECIFIED;
  }
};

// iata is optional with a ^[A-Z]{3}$ validator: send it upper-cased or not at all.
const place = (p: FlightPlace) => ({
  name: p.name.trim(),
  iata: p.iata?.trim().toUpperCase() || undefined,
});

/** The plan calls the panel makes. Components take this so tests can fake it. */
export interface PlanApi {
  setDates(
    tripId: string,
    start: string,
    end: string,
    baseVersion: bigint,
  ): Promise<ProtoTripDraft>;
  setStay(tripId: string, stay: TripStay, baseVersion: bigint): Promise<ProtoTripDraft>;
  clearStay(tripId: string, cityName: string, baseVersion: bigint): Promise<ProtoTripDraft>;
  addFlight(tripId: string, flight: FlightSearch, baseVersion: bigint): Promise<ProtoTripDraft>;
  removeFlight(tripId: string, flightId: string, baseVersion: bigint): Promise<ProtoTripDraft>;
  buildLinks(flight: FlightSearch): Promise<FlightLink[]>;
  hotelsNear(lat: number, lon: number): Promise<HotelDetailedInfo[]>;
}

export const planApi: PlanApi = {
  setDates: (tripId, startDate, endDate, baseVersion) =>
    tripClient.setTripDates(
      create(SetTripDatesRequestSchema, { tripId, startDate, endDate, baseVersion }),
    ),
  setStay: (tripId, s, baseVersion) =>
    tripClient.setStay(
      create(SetStayRequestSchema, {
        tripId,
        baseVersion,
        stay: {
          cityName: s.cityName,
          poiId: s.poiId ?? "",
          name: s.name,
          starRating: s.starRating ?? "",
          checkIn: s.checkIn || undefined,
          checkOut: s.checkOut || undefined,
          // The server takes https links only; anything else is left off.
          bookingUrl: s.bookingUrl?.startsWith("https://") ? s.bookingUrl : undefined,
        },
      }),
    ),
  clearStay: (tripId, cityName, baseVersion) =>
    tripClient.clearStay(create(ClearStayRequestSchema, { tripId, cityName, baseVersion })),
  addFlight: (tripId, f, baseVersion) =>
    tripClient.addFlight(
      create(AddFlightRequestSchema, {
        tripId,
        baseVersion,
        flight: {
          origin: place(f.origin),
          destination: place(f.destination),
          departDate: f.departDate,
          returnDate: f.returnDate || undefined,
          passengers: f.passengers,
          cabin: cabinFromName(f.cabin),
        },
      }),
    ),
  removeFlight: (tripId, flightId, baseVersion) =>
    tripClient.removeFlight(create(RemoveFlightRequestSchema, { tripId, flightId, baseVersion })),
  async buildLinks(f) {
    const res = await tripClient.buildFlightLinks(
      create(BuildFlightLinksRequestSchema, {
        origin: place(f.origin),
        destination: place(f.destination),
        departDate: f.departDate,
        returnDate: f.returnDate || undefined,
        passengers: f.passengers,
        cabin: cabinFromName(f.cabin),
      }),
    );
    return res.links.map((l) => ({ provider: l.provider, label: l.label, url: l.url }));
  },
  async hotelsNear(latitude, longitude) {
    const res = await favoritesClient.getNearbyHotels(
      create(GetNearbyHotelsRequestSchema, { latitude, longitude, radiusKm: 5, limit: 40 }),
    );
    return (res.hotels ?? []).map(mapProtoToHotel);
  },
};

/** A hotel's stars as a number: "4", "4.5", "4★", "★★★★". A number wins. */
export const starsOf = (s: string | number | undefined): number | undefined => {
  if (typeof s === "number") return s > 0 && s <= 5 ? s : undefined;
  if (!s) return undefined;
  const m = s.trim().match(/^\d+(\.\d+)?/);
  if (m) {
    const v = parseFloat(m[0]);
    return v > 0 && v <= 5 ? v : undefined;
  }
  const glyphs = (s.match(/★/g) ?? []).length;
  return glyphs > 0 && glyphs <= 5 ? glyphs : undefined;
};

/**
 * Hotels whose whole stars equal `stars`, best rated first. 0 means any star
 * rating and keeps unrated hotels; a chosen rating drops them, since nobody
 * asking for four stars wants a guess.
 */
export const hotelsWithStars = (hotels: HotelDetailedInfo[], stars: number): HotelDetailedInfo[] =>
  hotels
    .filter((h) => {
      if (stars === 0) return true;
      const v = starsOf(h.star_rating);
      return v !== undefined && Math.floor(v) === stars;
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

/** Where a city of the trip is, from the first day spent there. */
export const cityCoords = (
  trip: Pick<Trip, "cityName" | "days">,
  city: string,
): { lat: number; lon: number } | undefined => {
  const want = city.trim().toLowerCase();
  const isPrimary = trip.cityName.trim().toLowerCase() === want;
  const day = trip.days.find((d) => {
    const name = (d.cityName ?? "").trim().toLowerCase();
    return (name === want || (name === "" && isPrimary)) && d.cityLat != null && d.cityLon != null;
  });
  return day ? { lat: day.cityLat!, lon: day.cityLon! } : undefined;
};

/** The cities a stay can be set for: a multi-city trip's, else the trip's own. */
export const tripCities = (trip: Pick<Trip, "cityName" | "cities">): string[] =>
  trip.cities?.length ? trip.cities.map((c) => c.cityName) : trip.cityName ? [trip.cityName] : [];
