// Putting a hotel from a comparison report on a trip as its stay, when the
// server found no trip to propose it for and the traveller picks one.
import type { ComparedHotel } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/hotel_report_pb.js";
import type { TripDraft as ProtoTripDraft } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import {
  fetchTrip,
  isTripConflict,
  mapStay,
  mapTrip,
  type Trip,
  type TripStay,
} from "../api/trips";
import { planApi } from "../api/trip-plan";

/** What a report card remembers once one of its hotels is on a trip. */
export interface StayAdded {
  tripId: string;
  tripTitle?: string;
  hotelName: string;
}

/** The hotel's name as the card says it. The server always names the stay. */
export const hotelName = (hotel: ComparedHotel, index: number): string =>
  hotel.stay?.name.trim() || `Hotel ${index + 1}`;

const fold = (s: string) => s.trim().toLowerCase();

/**
 * The trip's own spelling of `city`, when the trip goes there: its primary
 * city, one of a multi-city trip's cities, or a day's city. Matched the way
 * the server matches a stay's city, by case and surrounding spaces only.
 */
export function cityOnTrip(
  trip: Pick<Trip, "cityName" | "cities" | "days">,
  city: string,
): string | undefined {
  const want = fold(city);
  if (!want) return undefined;
  const names = [
    trip.cityName,
    ...(trip.cities ?? []).map((c) => c.cityName),
    ...trip.days.map((d) => d.cityName ?? ""),
  ];
  return names.find((n) => n && fold(n) === want);
}

export type StayEligibility = { ok: true; cityName: string } | { ok: false; reason: string };

/** Whether a hotel in `city` can be set as this trip's stay by the caller. */
export function stayEligibility(
  trip: Pick<Trip, "cityName" | "cities" | "days" | "owner">,
  city: string,
): StayEligibility {
  const cityName = cityOnTrip(trip, city);
  if (!cityName) return { ok: false, reason: `${city} isn't on this trip` };
  // Someone else's trip: only its planner sets where it stays.
  if (trip.owner) return { ok: false, reason: "Only the trip's planner can set the stay" };
  return { ok: true, cityName };
}

/** The two calls the picker makes. Components take this so tests can fake it. */
export interface StayWriter {
  fetchTrip(id: string): Promise<Trip>;
  setStay(tripId: string, stay: TripStay, baseVersion: bigint): Promise<ProtoTripDraft>;
}

export const stayWriter: StayWriter = {
  fetchTrip,
  setStay: (tripId, stay, baseVersion) => planApi.setStay(tripId, stay, baseVersion),
};

/** The city left the trip between the list being read and the pick. */
export class CityNotOnTripError extends Error {}

/**
 * Sets the hotel as the trip's stay. The trips list can be minutes old, so the
 * trip is read again for its version (and its spelling of the city); a write
 * that still loses a race is tried once more against the latest.
 */
export async function setStayFromReport(
  api: StayWriter,
  tripId: string,
  hotel: ComparedHotel,
  city: string,
): Promise<Trip> {
  if (!hotel.stay) throw new Error("hotel has no stay");
  let trip = await api.fetchTrip(tripId);
  const cityName = cityOnTrip(trip, city);
  if (!cityName) throw new CityNotOnTripError(city);
  const stay: TripStay = { ...mapStay(hotel.stay), cityName };
  try {
    return mapTrip(await api.setStay(trip.id, stay, trip.version));
  } catch (err) {
    if (!isTripConflict(err)) throw err;
    trip = await api.fetchTrip(tripId);
    return mapTrip(await api.setStay(trip.id, stay, trip.version));
  }
}
