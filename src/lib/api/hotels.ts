// Hotels queries - Using RPC
import { useQuery } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  FavoritesService,
  GetHotelDetailsRequestSchema,
  GetNearbyHotelsRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { transport } from "../connect-transport";
import { queryKeys } from "./shared";
import type { HotelDetailedInfo } from "./types";
import { useAppQuery } from "./authed-query";

const favoritesClient = createClient(FavoritesService, transport);

// Helper to map proto to client type
const mapProtoToHotel = (proto: any): HotelDetailedInfo => ({
  id: proto.id,
  name: proto.name,
  city: proto.city,
  description: proto.description,
  latitude: proto.latitude,
  longitude: proto.longitude,
  address: proto.address,
  category: proto.category,
  rating: proto.rating,
  price_level: proto.priceRange,
  amenities: proto.amenities || [],
  tags: [],
  images: proto.images || [],
  phone_number: proto.phone,
  website: proto.website,
  llm_interaction_id: proto.llmInteractionId,
});

// =================
// HOTELS QUERIES (RPC)
// =================

// Get nearby hotels
export const useNearbyHotels = (lat: number, lng: number, radius?: number) => {
  return useAppQuery(() => ({
    queryKey: queryKeys.nearbyHotels(lat, lng, radius),
    queryFn: async (): Promise<HotelDetailedInfo[]> => {
      const request = create(GetNearbyHotelsRequestSchema, {
        latitude: lat,
        longitude: lng,
        radiusKm: radius || 5,
        limit: 20,
      });
      const response = await favoritesClient.getNearbyHotels(request);
      return (response.hotels || []).map(mapProtoToHotel);
    },
    enabled: !!(lat && lng),
    staleTime: 15 * 60 * 1000,
  }));
};

// Get hotel details
export const useHotelDetails = (hotelId: string) => {
  return useAppQuery(() => ({
    queryKey: queryKeys.hotelDetails(hotelId),
    queryFn: async (): Promise<HotelDetailedInfo> => {
      const request = create(GetHotelDetailsRequestSchema, { hotelId });
      const response = await favoritesClient.getHotelDetails(request);
      if (!response.hotel) {
        throw new Error("Hotel not found");
      }
      return mapProtoToHotel(response.hotel);
    },
    enabled: !!hotelId,
    staleTime: 30 * 60 * 1000,
  }));
};

// Note: useHotelsByPreferences is LLM-driven and uses streaming chat
// It should remain in llm.ts or use the chat streaming endpoint
export const useHotelsByPreferences = (preferences: any) => {
  // This is LLM-driven and handled by the streaming chat service
  // Keeping a stub here for backwards compatibility
  return useAppQuery(() => ({
    queryKey: queryKeys.hotelsByPreferences(preferences),
    queryFn: async (): Promise<HotelDetailedInfo[]> => {
      // LLM-driven queries should use the streaming chat endpoint
      // Return empty for now - actual implementation uses sendUnifiedChatMessageStream
      console.warn("useHotelsByPreferences: Use streaming chat for LLM-driven hotel search");
      return [];
    },
    enabled: false, // Disabled - use streaming chat instead
    staleTime: 10 * 60 * 1000,
  }));
};
