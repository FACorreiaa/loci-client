// Favorites hooks using FavoritesService RPC
import { createMemo } from "solid-js";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import {
  FavoritesService,
  AddToFavoritesRequestSchema,
  RemoveFromFavoritesRequestSchema,
  GetFavoritesRequestSchema,
  ContentType,
} from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { create } from "@bufbuild/protobuf";
import { transport } from "../connect-transport";
import { getAuthToken } from "../api";
import { handleEntitlementError } from "../entitlement-error";
import { useAppQuery } from "./authed-query";
import { queryKeys } from "./shared";
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

/**
 * Forget the cached identity. Called on sign-in and sign-out: the id is cached
 * for five minutes, so without this the next user's favourites are fetched
 * under the previous user's id.
 */
export const clearFavoritesIdentityCache = (): void => {
  cachedUserId = null;
  cacheTimestamp = 0;
};

// Helper to get current user ID from JWT token
export const getCurrentUserId = (): string | null => {
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

/**
 * Fetch the account's favourites.
 *
 * This deliberately does NOT catch. It used to return an empty list on any
 * failure, which made `isError` unreachable and rendered an expired session as
 * "No favorites found" — the page could not tell "nothing saved" from "we could
 * not ask". Callers gate on `enabled` instead, so reaching here without an id
 * is a programming error worth surfacing.
 */
async function fetchFavorites(): Promise<{ items: string[]; favorites: any[] }> {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error("Not signed in");
  }

  const response = await favoritesClient.getFavorites(
    create(GetFavoritesRequestSchema, {
      // The server takes the user from the token and ignores this, but
      // buf.validate requires it to be non-empty before the handler runs.
      userId: userId,
      limit: 1000, // Get all favorites
    }),
  );

  return { items: response.favorites.map((f) => f.itemId), favorites: response.favorites };
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
  return item.name.toLowerCase().replace(/\s+/g, "-");
}

// Add item to favorites
async function addToFavorites(item: FavoriteItem): Promise<boolean> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not signed in");

  const itemId = getStableItemId(item);

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
    return true;
  } catch (error) {
    // Entitlement errors get their own UI; everything else must reach the
    // mutation so the caller can tell a save apart from a silent no-op.
    handleEntitlementError(error);
    throw error;
  }
}

// Remove item from favorites
async function removeFromFavorites(itemId: string, contentType: string): Promise<boolean> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not signed in");

  await favoritesClient.removeFromFavorites(
    create(RemoveFromFavoritesRequestSchema, {
      userId: userId,
      itemId: itemId,
      contentType: getContentTypeEnum(contentType),
    }),
  );
  return true;
}

/**
 * The account's favourites.
 *
 * The user id is part of the key on purpose: without it, the empty result
 * cached before sign-in stayed fresh for two minutes afterwards, and the
 * previous user's favourites could outlive a sign-out.
 *
 * `enabled` may be an accessor, so a page that mounts before auth settles
 * still fetches once it does.
 */
export function useFavoritesList(options: { enabled?: boolean | (() => boolean) } = {}) {
  return useAppQuery(() => {
    const userId = getCurrentUserId();
    const wanted =
      typeof options.enabled === "function" ? options.enabled() : (options.enabled ?? true);
    return {
      queryKey: queryKeys.favoritesList(userId),
      queryFn: fetchFavorites,
      staleTime: 2 * 60 * 1000, // 2 minutes
      enabled: wanted && !!userId,
    };
  });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.favoritesRoot });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.favoritesRoot });
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
