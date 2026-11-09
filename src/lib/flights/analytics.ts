// Flight search usage, the same three events and properties iOS sends
// (Features/Flights/FlightAnalytics.swift). Codes only: nothing the
// traveller typed leaves the browser.
import { capture } from "~/lib/analytics";
import type { FlightLink } from "~/lib/api/trips";
import type { FlightSearch } from "~/lib/api/trip-plan";

export type FlightSource = "itinerary" | "hotels" | "restaurants" | "activities" | "trip" | "chat";

const code = (iata?: string) => {
  const c = iata?.trim().toUpperCase();
  return c && /^[A-Z]{3}$/.test(c) ? c : undefined;
};

const route = (search?: FlightSearch) => {
  const out: Record<string, string> = {};
  const o = code(search?.origin.iata);
  const d = code(search?.destination.iata);
  if (o) out.origin_iata = o;
  if (d) out.destination_iata = d;
  return out;
};

export function trackFlightOpened(source: FlightSource, destinationIata?: string): void {
  const d = code(destinationIata);
  capture("flight_search_opened", d ? { source, destination_iata: d } : { source });
}

export function trackFlightBuilt(source: FlightSource, search: FlightSearch): void {
  capture("flight_search_built", {
    source,
    ...route(search),
    has_return: Boolean(search.returnDate),
    passengers: search.passengers,
    cabin: search.cabin ?? "unspecified",
  });
}

export function trackFlightClicked(
  source: FlightSource,
  link: FlightLink,
  search?: FlightSearch,
): void {
  capture("flight_link_clicked", { source, provider: link.provider, ...route(search) });
}
