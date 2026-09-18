import { createClient } from "@connectrpc/connect";
import {
  RecentsService,
  GetRecentInteractionsRequestSchema,
  GetInteractionHistoryRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/recents/recents_pb.js";
import { create } from "@bufbuild/protobuf";
import { transport } from "../connect-transport";
import { getAuthToken, authAPI } from "../api";
import type { RecentInteractionsResponse, CityInteractions } from "./types";
import { useAppQuery } from "./authed-query";
import { stripPromptWrapper } from "./prompt-wrapper";
import { useAuthGate } from "../auth/useAuthGate";
import type { ActivityEntry, ActivityKind } from "../recents/types";

// Create authenticated recents client
const recentsClient = createClient(RecentsService, transport);

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

// Helper to get current user ID from JWT token directly
// This avoids the race condition where validateSession fails immediately after login
const getCurrentUserId = async (): Promise<string | null> => {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  // Parse user_id directly from JWT to avoid validateSession race condition
  const payload = parseJwt(token);
  if (payload?.user_id) {
    return payload.user_id;
  }

  // Fallback: try validateSession if JWT parsing fails
  try {
    const session = await authAPI.validateSession();
    if (session.valid && session.user_id) {
      return session.user_id;
    }
  } catch (e) {
    console.warn("Failed to get user ID from session:", e);
  }
  return null;
};

// Fetch recent interactions via RPC
async function fetchRecentInteractions(limit: number = 10): Promise<RecentInteractionsResponse> {
  console.log("🕐 fetchRecentInteractions: Starting...");
  const userId = await getCurrentUserId();
  console.log("🕐 fetchRecentInteractions: User ID:", userId);

  if (!userId) {
    console.warn("🕐 No user ID available for recents");
    return { cities: [], total: 0, offset: 0, limit };
  }

  try {
    console.log("🕐 fetchRecentInteractions: Making RPC call to GetRecentInteractions");
    const response = await recentsClient.getRecentInteractions(
      create(GetRecentInteractionsRequestSchema, {
        userId: userId,
        limit: limit,
        offset: 0,
        groupByCity: true,
      }),
    );

    console.log("🕐 fetchRecentInteractions: Response received", response);

    // Helper to extract clean message from "Unified Chat Stream - Domain: X, Message: Y" format
    const extractMessage = (description: string, cityName: string): string => {
      if (!description) return cityName;

      // Unwrap the prompt the server built around the user's message
      const message = stripPromptWrapper(description);
      if (message !== description) {
        // If message ends with just the city name, include it
        if (message && message !== cityName) {
          return message.endsWith(cityName) ? message : `${message} ${cityName}`;
        }
        return message || cityName;
      }

      // If no match, check if it's a POI lookup prompt (starts with "Return ONLY")
      if (description.startsWith("Return ONLY")) {
        const poiMatch = description.match(/for "([^"]+)" in ([^.]+)/);
        if (poiMatch) {
          return `Looking up ${poiMatch[1]} in ${poiMatch[2]}`;
        }
      }

      // Fallback to first 50 chars or city name
      return description.length > 50 ? description.slice(0, 50) + "..." : description || cityName;
    };

    // Map proto response to frontend types
    const cities: CityInteractions[] = (response.citySummaries || []).map((summary) => ({
      city_name: summary.cityName || "",
      city_id: summary.cityId || null,
      interactions: (summary.recentInteractions || []).map((interaction) => ({
        id: interaction.id || "",
        user_id: interaction.userId || "",
        city_name: summary.cityName || "",
        city_id: null,
        prompt: extractMessage(interaction.description || "", summary.cityName || ""),
        response_text: "",
        model_used: "",
        latency_ms: 0,
        created_at: interaction.createdAt
          ? new Date(Number(interaction.createdAt.seconds) * 1000).toISOString()
          : new Date().toISOString(),
        pois: [],
        hotels: [],
        restaurants: [],
      })),
      poi_count: Number(summary.interactionCount || 0),
      last_activity: summary.latestInteraction
        ? new Date(Number(summary.latestInteraction.seconds) * 1000).toISOString()
        : new Date().toISOString(),
      total_interactions: Number(summary.interactionCount || 0),
      total_favorites: 0,
      total_itineraries: 0,
    }));

    console.log("🕐 fetchRecentInteractions: Mapped cities", cities.length, cities);

    return {
      cities,
      total: Number(response.totalCount || 0),
      offset: 0,
      limit,
    };
  } catch (error) {
    console.error("🕐 Failed to fetch recent interactions via RPC:", error);
    return { cities: [], total: 0, offset: 0, limit };
  }
}

// Hook for recent interactions (RPC-based)
export const useRecentInteractions = (limit: number = 10) => {
  return useAppQuery(() => ({
    queryKey: ["recents", "interactions", limit],
    queryFn: () => fetchRecentInteractions(limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
  }));
};

// Hook for city details (uses same RPC but filters)
export const useCityDetails = (cityName: string) => {
  return useAppQuery(() => ({
    queryKey: ["recents", "city", cityName],
    queryFn: async (): Promise<CityInteractions | null> => {
      const response = await fetchRecentInteractions(50);
      const city = response.cities.find((c) => c.city_name === cityName);
      return city || null;
    },
    enabled: !!cityName,
    staleTime: 5 * 60 * 1000, // 5 minutes
  }));
};

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

/**
 * One page of the recents activity feed: every prompt the person sent, every
 * itinerary they kept and every place they favourited, newest first.
 *
 * This is a different shape from `useRecentInteractions` above and deliberately
 * so. That one groups by city, which answers "where have I been"; the feed
 * answers "what did I do", and a city grid cannot.
 *
 * Note what is NOT sent: an `InteractionFilter`. Its `city_id` and
 * `search_query` fields are declared with `min_len: 1` and no ignore rule, so
 * the server's validation interceptor rejects any filter that leaves them
 * blank — which is every filter that only narrows by type. The proto is fixed
 * in loci-connect-proto but the fix is not in a released module yet, so until
 * it is the feed asks for everything and the chips narrow what has loaded.
 * `sort_by` and `sort_order` are sent for the same reason: their `in` rules
 * reject the empty default.
 */
async function fetchActivityHistory(limit: number, offset: number): Promise<ActivityPage> {
  const userId = await getCurrentUserId();
  if (!userId) return { entries: [], hasMore: false };

  const response = await recentsClient.getInteractionHistory(
    create(GetInteractionHistoryRequestSchema, {
      userId,
      limit,
      offset,
      sortBy: "date",
      sortOrder: "desc",
    }),
  );

  const entries = (response.interactions || []).map(mapActivityEntry);
  // total_count is a floor, not a total: the server reports one more than it
  // has served when another page exists rather than counting a three-way union
  // on every request. See the handler for why.
  const hasMore = offset + entries.length < Number(response.totalCount || 0);

  return { entries, hasMore };
}

export interface ActivityPage {
  entries: ActivityEntry[];
  hasMore: boolean;
}

/**
 * Map one proto interaction onto a feed entry.
 *
 * `entityType` carries the feed kind for a save or a favourite and the routed
 * domain for a prompt; `metadata.kind` is the unambiguous discriminator and
 * `metadata.content_type` narrows a favourite.
 */
function mapActivityEntry(interaction: {
  id: string;
  entityId: string;
  entityType: string;
  description: string;
  cityName: string;
  metadata: Record<string, string>;
  createdAt?: { seconds: bigint } | undefined;
}): ActivityEntry {
  const kind = (interaction.metadata?.kind as ActivityKind) || "prompt";
  const detail =
    kind === "favourite"
      ? interaction.metadata?.content_type || "poi"
      : kind === "saved_itinerary"
        ? "itinerary"
        : interaction.entityType || "general";

  return {
    id: interaction.id || "",
    kind,
    detail,
    // The server unwraps the prompt wrapper before sending. This second pass
    // costs nothing and keeps the page correct against an older server.
    label: stripPromptWrapper(interaction.description || ""),
    cityName: interaction.cityName || "",
    refId: interaction.entityId || "",
    occurredAt: interaction.createdAt
      ? new Date(Number(interaction.createdAt.seconds) * 1000).toISOString()
      : new Date().toISOString(),
  };
}

export const ACTIVITY_PAGE_SIZE = 40;

/**
 * The feed, one page at a time.
 *
 * Unlike `fetchRecentInteractions` above, a failure here is not swallowed into
 * an empty result: a feed that silently shows "no recent activity" when the API
 * is down is indistinguishable from a feed that is genuinely empty, and the two
 * call for very different things from the reader.
 */
export const useActivityHistory = (pages: () => number) => {
  const gate = useAuthGate();
  return useAppQuery(() => ({
    queryKey: ["recents", "activity", pages()],
    queryFn: async (): Promise<ActivityPage> => {
      // Pages accumulate into one list rather than being kept separate: "load
      // more" on a feed appends, and refetching the whole range keeps the
      // merged ordering correct when something new arrives at the top.
      return fetchActivityHistory(ACTIVITY_PAGE_SIZE * pages(), 0);
    },
    enabled: gate(),
    staleTime: 60 * 1000,
  }));
};
