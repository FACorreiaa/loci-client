// Favorites hooks using FavoritesService RPC
import { createMemo } from "solid-js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import {
  FavoritesService,
  AddToFavoritesRequestSchema,
  RemoveFromFavoritesRequestSchema,
  GetFavoritesRequestSchema,
  IsFavoritedRequestSchema,
  ContentType,
} from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { create } from "@bufbuild/protobuf";
import { transport } from "../connect-transport";
import { getAuthToken } from "../api";
import { handleEntitlementError } from "../entitlement-error";
import { useAppQuery } from "./authed-query";
import { capture } from "~/lib/analytics";

// Create authenticated favorites client
const favoritesClient = createClient(FavoritesService, transport);

// Helper to parse JWT payload
const parseJwt = (token: string): { user_id?: string } | null => {
  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return null;
    return JSON.parse(atob(payloadBase64));
  } catch (e) {
    console.warn("Failed to parse JWT:", e);
    return null;
  }
};

// Cache for user ID
let cachedUserId: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to get current user ID from JWT token
const getCurrentUserId = (): string | null => {
  const now = Date.now();
  if (cachedUserId && now - cacheTimestamp < CACHE_TTL) {
    return cachedUserId;
  }

  const token = getAuthToken();
  if (!token) {
    cachedUserId = null;
    return null;
  }

  const payload = parseJwt(token);
  if (payload?.user_id) {
    cachedUserId = payload.user_id;
    cacheTimestamp = now;
    return cachedUserId;
  }

  return null;
};

// Types
export interface FavoriteItem {
  id: string;
  name: string;
  contentType: "poi" | "hotel" | "restaurant" | "itinerary";
  description?: string;
  llmInteractionId?: string;
  cityName?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  category?: string;
}

// Map content type string to proto enum
function getContentTypeEnum(type: string): ContentType {
  switch (type) {
    case "poi":
      return ContentType.POI;
    case "restaurant":
      return ContentType.RESTAURANT;
    case "hotel":
      return ContentType.HOTEL;
    case "itinerary":
      return ContentType.ITINERARY;
    default:
      return ContentType.POI;
  }
}

// Fetch favorites list
async function fetchFavorites(): Promise<{ items: string[]; favorites: any[] }> {
  const userId = getCurrentUserId();
  if (!userId) {
    return { items: [], favorites: [] };
  }

  try {
    const response = await favoritesClient.getFavorites(
      create(GetFavoritesRequestSchema, {
        userId: userId,
        limit: 1000, // Get all favorites
      }),
    );

    const items = response.favorites.map((f) => f.itemId);
    console.log("favorites: Fetched", items.length, "favorites");
    return { items, favorites: response.favorites };
  } catch (error) {
    console.error("Failed to fetch favorites:", error);
    return { items: [], favorites: [] };
  }
}

// Helper to check if ID is valid (not nil UUID or empty)
function isValidId(id: string): boolean {
  if (!id || id.trim() === "") return false;
  // Check for nil UUID patterns
  if (id === "00000000-0000-0000-0000-000000000000") return false;
  if (id.match(/^0+$/)) return false;
  return true;
}

// Generate a stable item ID using name if ID is invalid
function getStableItemId(item: FavoriteItem): string {
  if (isValidId(item.id)) {
    return item.id;
  }
  // Use name as identifier if ID is invalid
  // Normalize: lowercase, remove spaces
  const normalized = item.name.toLowerCase().replace(/\s+/g, "-");
  console.warn(`favorites: Using name-based ID for "${item.name}": ${normalized}`);
  return normalized;
}

// Add item to favorites
async function addToFavorites(item: FavoriteItem): Promise<boolean> {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn("favorites: No user ID, cannot add to favorites");
    return false;
  }

  const itemId = getStableItemId(item);
  console.log("favorites: Adding to favorites:", { itemId, name: item.name, originalId: item.id });

  try {
    await favoritesClient.addToFavorites(
      create(AddToFavoritesRequestSchema, {
        userId: userId,
        itemId: itemId,
        itemName: item.name,
        contentType: getContentTypeEnum(item.contentType),
        description: item.description || "",
        cityName: item.cityName || "",
        latitude: item.latitude || 0,
        longitude: item.longitude || 0,
        rating: item.rating || 0,
        category: item.category || "",
        llmInteractionId: item.llmInteractionId || "",
      }),
    );
    console.log("favorites: Added to favorites:", item.name);
    return true;
  } catch (error) {
    handleEntitlementError(error);
    console.error("Failed to add to favorites:", error);
    return false;
  }
}

// Remove item from favorites
async function removeFromFavorites(itemId: string, contentType: string): Promise<boolean> {
  const userId = getCurrentUserId();
  if (!userId) return false;

  try {
    await favoritesClient.removeFromFavorites(
      create(RemoveFromFavoritesRequestSchema, {
        userId: userId,
        itemId: itemId,
        contentType: getContentTypeEnum(contentType),
      }),
    );
    console.log("favorites: Removed from favorites:", itemId);
    return true;
  } catch (error) {
    console.error("Failed to remove from favorites:", error);
    return false;
  }
}

// Check if item is favorited (kept for future use)
async function _checkIsFavorited(itemId: string, contentType: string): Promise<boolean> {
  const userId = getCurrentUserId();
  if (!userId) return false;

  try {
    const response = await favoritesClient.isFavorited(
      create(IsFavoritedRequestSchema, {
        userId: userId,
        itemId: itemId,
        contentType: getContentTypeEnum(contentType),
      }),
    );
    return response.isFavorited;
  } catch (error) {
    console.error("Failed to check favorite:", error);
    return false;
  }
}

// Hook: Get favorites list
export function useFavoritesList() {
  return useAppQuery(() => ({
    queryKey: ["favorites", "list"],
    queryFn: fetchFavorites,
    staleTime: 2 * 60 * 1000, // 2 minutes
  }));
}

// Hook: Check if item is favorited
export function useIsFavorited(itemId: () => string) {
  const favoritesQuery = useFavoritesList();

  return createMemo(() => {
    const favorites = favoritesQuery.data;
    if (!favorites) return false;
    return favorites.items.includes(itemId());
  });
}

// Hook: Add to favorites mutation
export function useAddToFavorites() {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: addToFavorites,
    onSuccess: () => {
      capture("poi_saved", { surface: "favorites" });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  }));
}

// Hook: Remove from favorites mutation
export function useRemoveFromFavorites() {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: ({ itemId, contentType }: { itemId: string; contentType: string }) =>
      removeFromFavorites(itemId, contentType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  }));
}

// Hook: Toggle favorite (combined add/remove)
export function useToggleFavorite() {
  const addMutation = useAddToFavorites();
  const removeMutation = useRemoveFromFavorites();
  const favoritesQuery = useFavoritesList();

  const toggleFavorite = async (item: FavoriteItem) => {
    const favorites = favoritesQuery.data;
    const stableId = getStableItemId(item);
    const isFavorited = favorites?.items.includes(stableId);

    if (isFavorited) {
      await removeMutation.mutateAsync({ itemId: stableId, contentType: item.contentType });
    } else {
      await addMutation.mutateAsync(item);
    }
  };

  const isLoading = () => addMutation.isPending || removeMutation.isPending;

  return { toggleFavorite, isLoading, getStableItemId };
}
