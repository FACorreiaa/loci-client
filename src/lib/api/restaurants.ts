// Restaurants queries - Using RPC
import { useQuery } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  FavoritesService,
  GetRestaurantDetailsRequestSchema,
  GetNearbyRestaurantsRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { transport } from "../connect-transport";
import { queryKeys } from "./shared";
import type { RestaurantDetailedInfo } from "./types";
import { useAppQuery } from "./authed-query";

const favoritesClient = createClient(FavoritesService, transport);

// Helper to map proto to client type
const mapProtoToRestaurant = (proto: any): RestaurantDetailedInfo => ({
  id: proto.id,
  name: proto.name,
  city: proto.city,
  description: proto.description,
  latitude: proto.latitude,
  longitude: proto.longitude,
  address: proto.address,
  category: proto.category,
  rating: proto.rating,
  cuisine_type: proto.cuisineType,
  price_level: proto.priceRange,
  tags: proto.tags || [],
  images: proto.images || [],
  phone_number: proto.phone,
  website: proto.website,
  llm_interaction_id: proto.llmInteractionId,
});

// =====================
// RESTAURANTS QUERIES (RPC)
// =====================

// Get nearby restaurants
export const useNearbyRestaurants = (lat: number, lng: number, radius?: number) => {
  return useAppQuery(() => ({
    queryKey: queryKeys.nearbyRestaurants(lat, lng, radius),
    queryFn: async (): Promise<RestaurantDetailedInfo[]> => {
      const request = create(GetNearbyRestaurantsRequestSchema, {
        latitude: lat,
        longitude: lng,
        radiusKm: radius || 5,
        limit: 20,
      });
      const response = await favoritesClient.getNearbyRestaurants(request);
      return (response.restaurants || []).map(mapProtoToRestaurant);
    },
    enabled: !!(lat && lng),
    staleTime: 15 * 60 * 1000,
  }));
};

// Get restaurant details
export const useRestaurantDetails = (restaurantId: string) => {
  return useAppQuery(() => ({
    queryKey: queryKeys.restaurantDetails(restaurantId),
    queryFn: async (): Promise<RestaurantDetailedInfo> => {
      const request = create(GetRestaurantDetailsRequestSchema, { restaurantId });
      const response = await favoritesClient.getRestaurantDetails(request);
      if (!response.restaurant) {
        throw new Error("Restaurant not found");
      }
      return mapProtoToRestaurant(response.restaurant);
    },
    enabled: !!restaurantId,
    staleTime: 30 * 60 * 1000,
  }));
};

// Note: useRestaurantsByPreferences is LLM-driven and uses streaming chat
// It should remain in llm.ts or use the chat streaming endpoint
export const useRestaurantsByPreferences = (preferences: any) => {
  // This is LLM-driven and handled by the streaming chat service
  return useAppQuery(() => ({
    queryKey: queryKeys.restaurantsByPreferences(preferences),
    queryFn: async (): Promise<RestaurantDetailedInfo[]> => {
      // LLM-driven queries should use the streaming chat endpoint
      console.warn(
        "useRestaurantsByPreferences: Use streaming chat for LLM-driven restaurant search",
      );
      return [];
    },
    enabled: false, // Disabled - use streaming chat instead
    staleTime: 10 * 60 * 1000,
  }));
};
