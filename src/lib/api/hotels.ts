// Hotels queries - Using RPC
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  FavoritesService,
  GetHotelDetailsRequestSchema,
  GetNearbyHotelsRequestSchema,
  type HotelDetails,
} from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { transport } from "../connect-transport";
import { queryKeys } from "./shared";
import type { HotelDetailedInfo, POIImageCredit } from "./types";
import { useAppQuery } from "./authed-query";

const favoritesClient = createClient(FavoritesService, transport);

const orUndefined = (v: string | undefined | null): string | undefined =>
  v?.trim() ? v : undefined;

/**
 * The wire's HotelDetails as the client type.
 *
 * Only what the service actually fills is mapped into fields the page reads:
 * price band, star class, amenities, pictures, phone and website. The proto
 * also declares rooms, check-in times and a nightly price that the server has
 * never populated; they are carried through untouched so a page can show them
 * the day they appear, but nothing renders an empty one.
 */
export const mapProtoToHotel = (proto: HotelDetails): HotelDetailedInfo => {
  const stars = parseFloat(proto.starRating);
  // Pictures with a credit, when the service sends them (the type predates
  // credits; read defensively so a newer server is not a crash).
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
    star_rating: Number.isFinite(stars) && stars > 0 ? stars : undefined,
    price_level: orUndefined(proto.priceRange),
    priceRange: orUndefined(proto.priceRange),
    amenities: proto.amenities ?? [],
    tags: [],
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
    pricePerNight: orUndefined(proto.pricePerNight),
    reviewCount: proto.reviewCount || undefined,
    features: proto.features ?? [],
    nearbyAttractions: (proto.nearbyAttractions ?? []).map((n) => ({
      name: n.name,
      type: n.type,
      distance: n.distance,
    })),
  };
};

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

/** Thrown when the service answers without a hotel: the id names nothing. */
export const HOTEL_NOT_FOUND = "Hotel not found";

// Get hotel details
export const useHotelDetails = (hotelId: string) => {
  return useAppQuery(() => ({
    queryKey: queryKeys.hotelDetails(hotelId),
    queryFn: async (): Promise<HotelDetailedInfo> => {
      const request = create(GetHotelDetailsRequestSchema, { hotelId });
      const response = await favoritesClient.getHotelDetails(request);
      if (!response.hotel) {
        throw new Error(HOTEL_NOT_FOUND);
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
