// POI and favorites queries and mutations - Using RPC (REST removed)
import { createResource } from "solid-js";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { FavoritesService } from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { POIService } from "@buf/loci_loci-proto.bufbuild_es/loci/poi/poi_pb.js";
import type { POIDetailedInfo as ProtoPOI } from "@buf/loci_loci-proto.bufbuild_es/loci/poi/poi_pb.js";
import { transport } from "../connect-transport";
import { logger } from "../logger";
import { queryKeys } from "./shared";
import type { POI, POIDetailedInfo } from "./types";
import { useAppQuery } from "./authed-query";

const favoritesClient = createClient(FavoritesService, transport);
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

export const useFavorites = () => {
  return useAppQuery(() => ({
    queryKey: queryKeys.favorites,
    queryFn: async (): Promise<POIDetailedInfo[]> => {
      logger.debug("Fetching user favorites via RPC...");
      try {
        const response = await favoritesClient.getFavorites({});
        const favorites = (response.favorites || []).map((f) => ({
          id: f.itemId || "",
          name: f.itemName || "Unknown POI",
          description: f.description || "",
          latitude: f.latitude || 0,
          longitude: f.longitude || 0,
          category: f.category || "",
          rating: f.rating || 0,
          address: "",
          city: f.cityName || "",
          imageUrl: "",
        })) as POIDetailedInfo[];
        logger.debug("Favorites fetched via RPC:", favorites.length);
        return favorites;
      } catch (error) {
        logger.error("Failed to fetch favorites via RPC:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  }));
};

export const useAddToFavoritesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (params: { poiId: string; poiData?: POIDetailedInfo }) => {
      logger.debug("Adding POI to favorites via RPC:", params);
      try {
        await favoritesClient.addToFavorites({
          itemId: params.poiId,
          itemName: params.poiData?.name || "",
          description: params.poiData?.description || "",
          cityName: params.poiData?.city || "",
          latitude: params.poiData?.latitude || 0,
          longitude: params.poiData?.longitude || 0,
          rating: params.poiData?.rating || 0,
          category: params.poiData?.category || "",
        });
        logger.debug("Added to favorites via RPC");
        return { message: "Added to favorites" };
      } catch (error) {
        logger.error("Add to favorites failed:", error);
        throw error;
      }
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.favorites });
      const previousFavorites = queryClient.getQueryData(queryKeys.favorites);
      queryClient.setQueryData(queryKeys.favorites, (old: POI[] | undefined) => {
        const currentFavorites = old || [];
        const newPOI = params.poiData || ({ id: params.poiId, name: "POI" } as POI);
        return [...currentFavorites, newPOI];
      });
      return { previousFavorites };
    },
    onError: (error, params, context) => {
      logger.error("Add to favorites failed:", error);
      queryClient.setQueryData(queryKeys.favorites, context?.previousFavorites);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  }));
};

export const useRemoveFromFavoritesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (params: { poiId: string; poiData?: POIDetailedInfo }) => {
      logger.debug("Removing POI from favorites via RPC:", params);
      try {
        await favoritesClient.removeFromFavorites({
          itemId: params.poiId,
        });
        logger.debug("Removed from favorites via RPC");
        return { message: "Removed from favorites" };
      } catch (error) {
        logger.error("Remove from favorites failed:", error);
        throw error;
      }
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.favorites });
      const previousFavorites = queryClient.getQueryData(queryKeys.favorites);
      queryClient.setQueryData(queryKeys.favorites, (old: POI[] | undefined) => {
        const currentFavorites = old || [];
        return currentFavorites.filter((poi) => poi.id !== params.poiId);
      });
      return { previousFavorites };
    },
    onError: (err, params, context) => {
      logger.error("Remove from favorites failed:", err);
      if (context?.previousFavorites) {
        queryClient.setQueryData(queryKeys.favorites, context.previousFavorites);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  }));
};

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
