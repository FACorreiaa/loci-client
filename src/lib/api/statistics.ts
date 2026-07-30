import { useQuery } from "@tanstack/solid-query";
import { getAuthToken, authAPI } from "../api";
import { createClient } from "@connectrpc/connect";
import { StatisticsService } from "@buf/loci_loci-proto.bufbuild_es/loci/statistics/statistics_pb.js";
import { transport } from "../connect-transport";
import { useAuthGate } from "../auth/useAuthGate";
import { useAppQuery } from "./authed-query";

// Still needed by the SSE fallback below, which is a raw EventSource and not a
// Connect client.
const API_BASE_URL = import.meta.env.VITE_CONNECT_BASE_URL || "http://localhost:8000";

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

// Statistics use the app-wide transport. They used to build their own, which
// captured the access token once at creation time and carried no refresh
// interceptor: after the 1h access-token TTL every statistics call 401'd with a
// stale header, and nothing here could recover it. The shared transport handles
// both the Authorization header and the single-flight token refresh.
const statisticsClient = createClient(StatisticsService, transport);

// Statistics types (matching proto definitions)
export interface MainPageStatistics {
  total_users_count: number;
  total_itineraries_saved: number;
  total_unique_pois: number;
}

export interface DetailedPOIStatistics {
  general_pois: number;
  suggested_pois: number;
  hotels: number;
  restaurants: number;
  total_pois: number;
}

export interface StatisticsSSEEvent {
  type: "initial" | "update";
  timestamp: number;
  data: MainPageStatistics;
}

export interface LandingPageUserStats {
  saved_places: number;
  itineraries: number;
  cities_explored: number;
  discoveries: number;
}

// RPC API functions
export const getMainPageStatistics = async (): Promise<MainPageStatistics> => {
  try {
    const response = await statisticsClient.getMainPageStatistics({
      includeTrends: false,
      timeRange: "7d",
    });

    const stats = response.statistics;
    return {
      total_users_count: Number(stats?.totalUsers || 0),
      total_itineraries_saved: Number(stats?.totalItineraries || 0),
      total_unique_pois: Number(stats?.totalPois || 0),
    };
  } catch (error) {
    console.error("Failed to fetch main page statistics via RPC:", error);
    // Return zeros on error
    return {
      total_users_count: 0,
      total_itineraries_saved: 0,
      total_unique_pois: 0,
    };
  }
};

export const getDetailedPOIStatistics = async (): Promise<DetailedPOIStatistics> => {
  try {
    const response = await statisticsClient.getDetailedPOIStatistics({});

    const stats = response.statistics;
    return {
      general_pois: Number(stats?.favoritePoisCount || 0),
      suggested_pois: 0,
      hotels: 0,
      restaurants: 0,
      total_pois: Number(stats?.totalPoiSearches || 0),
    };
  } catch (error) {
    console.error("Failed to fetch detailed POI statistics via RPC:", error);
    return {
      general_pois: 0,
      suggested_pois: 0,
      hotels: 0,
      restaurants: 0,
      total_pois: 0,
    };
  }
};

export const getLandingPageStatistics = async (): Promise<LandingPageUserStats> => {
  console.log("📊 getLandingPageStatistics: Starting...");
  try {
    const token = getAuthToken();
    console.log("📊 getLandingPageStatistics: Token available?", !!token);
    if (!token) {
      console.log("📊 getLandingPageStatistics: No token, returning zeros");
      return {
        saved_places: 0,
        itineraries: 0,
        cities_explored: 0,
        discoveries: 0,
      };
    }

    // Get user ID from session for the RPC request
    const userId = await getCurrentUserId();
    console.log("📊 getLandingPageStatistics: User ID:", userId);
    if (!userId) {
      console.warn("📊 No user ID available for landing page statistics");
      return {
        saved_places: 0,
        itineraries: 0,
        cities_explored: 0,
        discoveries: 0,
      };
    }

    console.log("📊 getLandingPageStatistics: Making RPC call to GetLandingPageStatistics");
    const response = await statisticsClient.getLandingPageStatistics({
      userId: userId,
    });

    console.log("📊 getLandingPageStatistics: Response received", response);
    const stats = response.statistics;
    return {
      saved_places: Number(stats?.newFavoritesThisWeek || 0),
      itineraries: Number(stats?.itinerariesCreatedThisMonth || 0),
      cities_explored: Number(stats?.citiesExplored || 0),
      discoveries: Number(stats?.searchesThisWeek || 0),
    };
  } catch (error) {
    console.error("📊 Failed to fetch landing page statistics via RPC:", error);
    return {
      saved_places: 0,
      itineraries: 0,
      cities_explored: 0,
      discoveries: 0,
    };
  }
};

// Custom hooks for statistics
export const useMainPageStatistics = () => {
  return useAppQuery(() => ({
    queryKey: ["statistics", "main-page"],
    queryFn: getMainPageStatistics,
    // Twice a day is enough for the landing observability surface
    refetchInterval: 1000 * 60 * 60 * 12,
    staleTime: 1000 * 60 * 60 * 6,
    retry: 1,
  }));
};

export const useDetailedPOIStatistics = () => {
  const gate = useAuthGate();
  return useAppQuery(() => ({
    queryKey: ["statistics", "poi", "detailed"],
    queryFn: getDetailedPOIStatistics,
    refetchInterval: 60000, // Refetch every minute as fallback
    staleTime: 30000, // Consider data stale after 30 seconds
    enabled: gate(),
  }));
};

export const useLandingPageStatistics = () => {
  const gate = useAuthGate();
  return useAppQuery(() => ({
    queryKey: ["statistics", "landing-page"],
    queryFn: getLandingPageStatistics,
    refetchInterval: 60000, // Refetch every minute as fallback
    staleTime: 30000, // Consider data stale after 30 seconds
    enabled: gate(),
  }));
};

// SSE connection class for real-time statistics updates (kept for compatibility)
export class StatisticsSSE {
  private eventSource: EventSource | null = null;
  private onUpdate: ((stats: MainPageStatistics) => void) | null = null;
  private onError: ((error: Event) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  constructor(onUpdate: (stats: MainPageStatistics) => void, onError?: (error: Event) => void) {
    this.onUpdate = onUpdate;
    this.onError = onError as any;
  }

  connect() {
    try {
      // Get base URL from environment
      const baseURL = API_BASE_URL;

      // Statistics endpoint is public - no authentication required for aggregate stats
      const url = `${baseURL}/statistics/main-page/stream`;

      this.eventSource = new EventSource(url);

      this.eventSource.addEventListener("statistics", (event) => {
        try {
          const eventData: StatisticsSSEEvent = JSON.parse(event.data);
          this.onUpdate?.(eventData.data);
          this.reconnectAttempts = 0; // Reset on successful message
        } catch (error) {
          console.error("Error parsing SSE statistics data:", error);
        }
      });

      this.eventSource.onerror = (event) => {
        console.error("SSE Error:", event);
        this.onError?.(event);

        // Attempt reconnection with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(
            () => {
              this.reconnectAttempts++;
              console.log(
                `Attempting SSE reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
              );
              this.disconnect();
              this.connect();
            },
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
          );
        }
      };

      this.eventSource.onopen = () => {
        console.log("SSE connection established for statistics");
        this.reconnectAttempts = 0;
      };
    } catch (error) {
      console.error("Error creating SSE connection:", error);
      this.onError?.(error as Event);
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log("SSE connection closed");
    }
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// Hook for real-time statistics with SSE
export const useRealTimeStatistics = (
  onUpdate?: (stats: MainPageStatistics) => void,
  onError?: (error: Event) => void,
) => {
  let sseConnection: StatisticsSSE | null = null;

  const connect = () => {
    if (sseConnection) {
      sseConnection.disconnect();
    }

    sseConnection = new StatisticsSSE(
      (stats) => {
        onUpdate?.(stats);
      },
      (error) => {
        onError?.(error);
      },
    );

    sseConnection.connect();
  };

  const disconnect = () => {
    if (sseConnection) {
      sseConnection.disconnect();
      sseConnection = null;
    }
  };

  return {
    connect,
    disconnect,
    isConnected: () => sseConnection?.isConnected() ?? false,
  };
};
