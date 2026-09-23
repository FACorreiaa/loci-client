// Restaurants queries - Using RPC
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  FavoritesService,
  GetRestaurantDetailsRequestSchema,
  GetNearbyRestaurantsRequestSchema,
  type RestaurantDetails,
} from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { transport } from "../connect-transport";
import { queryKeys } from "./shared";
import type { POIImageCredit, RestaurantDetailedInfo } from "./types";
import { useAppQuery } from "./authed-query";

const favoritesClient = createClient(FavoritesService, transport);

const orUndefined = (v: string | undefined | null): string | undefined =>
  v?.trim() ? v : undefined;

/**
 * The wire's RestaurantDetails as the client type.
 *
 * cuisineType → cuisine, priceRange → priceRange, hours → hours, phone and
 * website → contact. The page used to read `cuisine`, `priceRange` and
 * `hours` while the mapping only wrote `cuisine_type` and `price_level`, so
 * the page rendered blanks; and it read `isOpen`, which nothing set, so every
 * restaurant was "Closed". Open-or-not is now derived from today's hours by
 * the page (see lib/results/domain.ts), never from a flag.
 *
 * The proto also declares a menu, reservation and card flags, languages and
 * an average price the server has never populated; they are carried through
 * untouched, and the page shows none of them while they are empty.
 */
export const mapProtoToRestaurant = (proto: RestaurantDetails): RestaurantDetailedInfo => {
  const hours = Object.fromEntries(
    Object.entries(proto.hours ?? {}).filter(([, v]) => typeof v === "string" && v.trim()),
  );
  const credits = ((proto as { imageCredits?: POIImageCredit[] }).imageCredits ?? []).filter(
    (c) => c?.url,
  );
  const images = proto.images?.length ? proto.images : credits.map((c) => c.url);
  return {
    id: proto.id,
    name: proto.name,
    city: proto.city,
    description: proto.description,
    latitude: proto.latitude,
    longitude: proto.longitude,
    address: orUndefined(proto.address),
    category: proto.category,
    rating: proto.rating,
    cuisine_type: orUndefined(proto.cuisineType),
    cuisine: orUndefined(proto.cuisineType),
    price_level: orUndefined(proto.priceRange),
    priceRange: orUndefined(proto.priceRange),
    hours: Object.keys(hours).length ? hours : undefined,
    opening_hours: Object.keys(hours).length ? JSON.stringify(hours) : undefined,
    tags: proto.tags ?? [],
    images,
    image_credits: credits.length ? credits : undefined,
    phone_number: orUndefined(proto.phone),
    website: orUndefined(proto.website),
    contact: {
      phone: orUndefined(proto.contact?.phone) ?? orUndefined(proto.phone),
      email: orUndefined(proto.contact?.email),
      website: orUndefined(proto.contact?.website) ?? orUndefined(proto.website),
    },
    llm_interaction_id: proto.llmInteractionId,
    reviewCount: proto.reviewCount || undefined,
    features: proto.features ?? [],
    specialties: proto.specialties ?? [],
    averagePrice: orUndefined(proto.averagePrice),
  };
};

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

/** Thrown when the service answers without a restaurant: the id names nothing. */
export const RESTAURANT_NOT_FOUND = "Restaurant not found";

// Get restaurant details
export const useRestaurantDetails = (restaurantId: string) => {
  return useAppQuery(() => ({
    queryKey: queryKeys.restaurantDetails(restaurantId),
    queryFn: async (): Promise<RestaurantDetailedInfo> => {
      const request = create(GetRestaurantDetailsRequestSchema, { restaurantId });
      const response = await favoritesClient.getRestaurantDetails(request);
      if (!response.restaurant) {
        throw new Error(RESTAURANT_NOT_FOUND);
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
