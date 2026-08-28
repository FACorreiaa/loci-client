// Shared utilities and types for API queries
import { useQueryClient } from "@tanstack/solid-query";

export const API_BASE_URL = import.meta.env.VITE_CONNECT_BASE_URL || "http://localhost:8000";

// Query Keys for consistent cache invalidation
export const queryKeys = {
  // Auth
  session: ["session"] as const,

  // Profiles
  profiles: ["profiles"] as const,
  profile: (id: string) => ["profiles", id] as const,
  defaultProfile: ["profiles", "default"] as const,

  // Interests
  interests: ["interests"] as const,
  interest: (id: string) => ["interests", id] as const,

  // Tags
  tags: ["tags"] as const,
  tag: (id: string) => ["tags", id] as const,

  // POIs
  favorites: ["pois", "favorites"] as const,
  poiDetails: (id: string) => ["pois", "details", id] as const,
  nearbyPois: (lat: number, lng: number, radius?: number) =>
    ["pois", "nearby", lat, lng, radius] as const,
  poisByCity: (cityId: string) => ["pois", "city", cityId] as const,
  searchPois: (query: string, filters?: any) => ["pois", "search", query, filters] as const,

  // Itineraries
  itineraries: (page: number, limit: number) => ["itineraries", page, limit] as const,
  itinerary: (id: string) => ["itineraries", id] as const,
  userItineraries: ["user-itineraries"] as const,

  // Lists
  lists: ["lists"] as const,
  list: (id: string) => ["lists", id] as const,

  // Hotels
  hotels: ["hotels"] as const,
  hotelsByPreferences: (preferences: Record<string, unknown>) =>
    ["hotels", "preferences", preferences] as const,
  nearbyHotels: (lat: number, lng: number, radius?: number) =>
    ["hotels", "nearby", lat, lng, radius] as const,
  hotelDetails: (id: string) => ["hotels", "details", id] as const,

  // Restaurants
  restaurants: ["restaurants"] as const,
  restaurantsByPreferences: (preferences: Record<string, unknown>) =>
    ["restaurants", "preferences", preferences] as const,
  nearbyRestaurants: (lat: number, lng: number, radius?: number) =>
    ["restaurants", "nearby", lat, lng, radius] as const,
  restaurantDetails: (id: string) => ["restaurants", "details", id] as const,

  // Settings
  settings: ["settings"] as const,
  userSettings: (profileId: string) => ["settings", profileId] as const,

  // Cities
  cities: ["cities"] as const,

  // Recents
  recents: ["recents"] as const,
  recentInteractions: (limit: number) => ["recents", "interactions", limit] as const,
  cityDetails: (cityName: string) => ["recents", "city", cityName] as const,

  // Travel history — where the user has actually been. Backs the globe.
  travelHistory: ["travel-history"] as const,
  globeData: (limit: number, periodDays: number) =>
    ["travel-history", "globe", limit, periodDays] as const,
  visitedCities: (page: number) => ["travel-history", "cities", page] as const,
  travelSummary: (periodDays: number) => ["travel-history", "summary", periodDays] as const,
};

// Utility hooks
export const useInvalidateUserQueries = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
    queryClient.invalidateQueries({ queryKey: queryKeys.interests });
    queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
    queryClient.invalidateQueries({ queryKey: queryKeys.lists });
    queryClient.invalidateQueries({ queryKey: queryKeys.settings });
  };
};

export const usePrefetchUserData = () => {
  // const queryClient = useQueryClient();

  return () => {
    // NOTE: Prefetch disabled - REST API removed, use RPC-based hooks directly
    console.log("usePrefetchUserData: Prefetch disabled - use RPC hooks");
  };
};
