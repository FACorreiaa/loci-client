// POI queries and mutations (RPC). Favourites live in ./favorites.ts — there
// used to be a second, parallel implementation here on a different cache key.
import { createResource } from "solid-js";
import { createClient } from "@connectrpc/connect";
import { POIService } from "@buf/loci_loci-proto.bufbuild_es/loci/poi/poi_pb.js";
import type { POIDetailedInfo as ProtoPOI } from "@buf/loci_loci-proto.bufbuild_es/loci/poi/poi_pb.js";
import { transport } from "../connect-transport";
import { queryKeys } from "./shared";
import type { POI } from "./types";
import { useAppQuery } from "./authed-query";

const poiClient = createClient(POIService, transport);

function mapProtoPOI(poi: ProtoPOI): POI {
  return {
    id: poi.id,
    name: poi.name,
    category: poi.category,
    description: poi.description || poi.descriptionPoi,
    description_poi: poi.descriptionPoi,
    latitude: poi.latitude || 0,
    longitude: poi.longitude || 0,
    rating: poi.rating,
    tags: poi.tags,
    priority: poi.priority,
    address: poi.address,
    website: poi.website,
    phone_number: poi.phoneNumber,
    opening_hours: Object.keys(poi.openingHours).length ? JSON.stringify(poi.openingHours) : null,
    // Both were dropped here: images silently, and the credits are new. A URL
    // without its licence and author cannot legally be rendered, so they travel
    // together or not at all.
    images: poi.images ?? [],
    image_credits: (poi.imageCredits ?? []).map((img) => ({
      url: img.url,
      source: img.source,
      licence: img.licence,
      attribution: img.attribution,
      source_page_url: img.sourcePageUrl,
    })),
    price_level: poi.priceLevel,
    price_range: poi.priceRange,
    distance: poi.distance,
    city: poi.city,
    city_id: poi.cityId,
    llm_interaction_id: poi.llmInteractionId,
  };
}

// ===============
// POI QUERIES - RPC
// ===============

export const usePOIDetails = (poiId: string) => {
  return useAppQuery(() => ({
    queryKey: queryKeys.poiDetails(poiId),
    queryFn: async (): Promise<POI | null> => {
      const response = await poiClient.getPOI({ poiId });
      return response.poi ? mapProtoPOI(response.poi) : null;
    },
    enabled: !!poiId,
    staleTime: 30 * 60 * 1000,
  }));
};

export const useNearbyPOIs = (params?: {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}) => {
  const [data, state] = createResource(async () => {
    if (!params?.latitude || !params?.longitude) return [];
    const response = await poiClient.searchPOI({
      latitude: params.latitude,
      longitude: params.longitude,
      radiusKm: params.radiusKm || 10,
      searchType: "hybrid",
    });
    return response.pois.map(mapProtoPOI);
  });
  return [() => data() || [], state] as const;
};

export const useSearchPOIs = (query: string, filters?: any) => {
  return useAppQuery(() => ({
    queryKey: queryKeys.searchPois(query, filters),
    queryFn: async (): Promise<POI[]> => searchPOIs(query, filters),
    enabled: !!query,
    staleTime: 5 * 60 * 1000,
  }));
};

export const searchPOIs = async (query: string, filters?: any): Promise<POI[]> => {
  const response = await poiClient.searchPOI({
    query,
    cityName: filters?.cityName || filters?.city || "",
    latitude: filters?.latitude || 0,
    longitude: filters?.longitude || 0,
    radiusKm: filters?.radiusKm,
    searchType: filters?.searchType || "semantic",
  });
  return response.pois.map(mapProtoPOI);
};
