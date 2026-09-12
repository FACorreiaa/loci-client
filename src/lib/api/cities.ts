// City search via CityService.SearchCities, used by the compare pickers.
//
// This module sat unused for a long time, and the reason was upstream: the
// server searched only the cities table, which holds cities some earlier
// conversation happened to generate content for. A picker backed by that offers
// nothing for most of the world. The server now tops up thin results from a
// geocoder and returns coordinates, so a selection can carry a position and let
// /compare skip name resolution entirely.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  CityService,
  SearchCitiesRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/city/city_pb.js";
import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const cityClient = createClient(CityService, transport);

export interface City {
  /** Empty when the city came from the geocoder and has no row yet. */
  id: string;
  name: string;
  country: string;
  stateProvince?: string;
  aiSummary: string;
  centerLatitude?: number;
  centerLongitude?: number;
}

/** Below this many characters a search matches too much to be worth sending. */
export const MIN_CITY_QUERY_LENGTH = 2;

const mapProtoToCity = (proto: {
  id: string;
  name: string;
  country: string;
  stateProvince?: string;
  aiSummary?: string;
  centerLatitude?: number;
  centerLongitude?: number;
}): City => ({
  id: proto.id,
  name: proto.name,
  country: proto.country,
  stateProvince: proto.stateProvince,
  aiSummary: proto.aiSummary || "",
  centerLatitude: proto.centerLatitude,
  centerLongitude: proto.centerLongitude,
});

export async function searchCities(query: string, limit = 8): Promise<City[]> {
  const request = create(SearchCitiesRequestSchema, { query, limit });
  const response = await cityClient.searchCities(request);
  return (response.cities || []).map(mapProtoToCity);
}

/**
 * Debounced city search for a typeahead.
 *
 * The debounce is not only about render churn: every miss the server cannot
 * answer from its own table costs an outbound geocoder request, so firing on
 * each keystroke would spend five of them typing "Porto".
 */
export function useCitySearch(query: Accessor<string>, debounceMs = 250) {
  const debounced = useDebounced(query, debounceMs);

  return useAppQuery(() => {
    const q = debounced().trim();
    return {
      queryKey: ["cities", "search", q],
      queryFn: () => searchCities(q),
      enabled: q.length >= MIN_CITY_QUERY_LENGTH,
      // A city's name and position do not change; only the set of matches does.
      staleTime: 30 * 60 * 1000,
    };
  });
}

/**
 * Mirrors a signal, settling only once it has stopped changing.
 *
 * Written here rather than reusing `debounce` from ~/lib/utils because that one
 * wraps a callback; a query key needs a value that is itself reactive.
 */
function useDebounced(source: Accessor<string>, delayMs: number): Accessor<string> {
  const [settled, setSettled] = createSignal(source());

  createEffect(() => {
    const next = source();
    const timer = setTimeout(() => setSettled(next), delayMs);
    // Every keystroke cancels the pending update, so only the pause at the end
    // of typing reaches the query.
    onCleanup(() => clearTimeout(timer));
  });

  return settled;
}
