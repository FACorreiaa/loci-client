// Query Client Configuration for @tanstack/solid-query
import { QueryClient } from "@tanstack/solid-query";
import { Code, ConnectError } from "@connectrpc/connect";
import { APIError } from "./api";

/**
 * Connect codes that mean "asking again gets the same answer".
 *
 * The retry guard used to check only `APIError`, the REST client's error type,
 * while every Connect RPC throws `ConnectError`. So an Unimplemented or
 * PermissionDenied RPC was retried three times with exponential backoff, and
 * the route sat on its Suspense fallback for ~7 s before the error surfaced.
 * These are all deterministic on the server's side: no amount of waiting turns
 * a missing handler, a bad argument or a revoked session into a success.
 */
const CONNECT_CODES_NOT_WORTH_RETRYING: ReadonlySet<Code> = new Set([
  Code.Unauthenticated,
  Code.PermissionDenied,
  Code.InvalidArgument,
  Code.NotFound,
  Code.Unimplemented,
  Code.FailedPrecondition,
]);

function isDeterministicConnectFailure(error: unknown): boolean {
  return error instanceof ConnectError && CONNECT_CODES_NOT_WORTH_RETRYING.has(error.code);
}

/** Retry predicate for queries: up to three attempts unless the failure is final. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isDeterministicConnectFailure(error)) return false;
  // Don't retry on 401 (unauthorized) or 403 (forbidden)
  if (error instanceof APIError && [401, 403].includes(error.status || 0)) {
    return false;
  }
  // Retry up to 3 times for other errors
  return failureCount < 3;
}

/** Retry predicate for mutations: one retry, and never for a client-side error. */
export function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  if (isDeterministicConnectFailure(error)) return false;
  if (error instanceof APIError && error.status && error.status >= 400 && error.status < 500) {
    return false; // Don't retry client errors
  }
  return failureCount < 1;
}

// Default query options for better UX
const defaultQueryOptions = {
  queries: {
    // How long data stays fresh (won't refetch while fresh)
    staleTime: 5 * 60 * 1000, // 5 minutes

    // How long to keep unused data in cache
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v4)

    // Retry configuration
    retry: shouldRetryQuery,

    // Retry delay increases exponentially
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Refetch on window focus for critical data
    refetchOnWindowFocus: true,

    // Refetch when network reconnects
    refetchOnReconnect: true,

    // Refetch on mount if data is stale
    refetchOnMount: true,
  },
  mutations: {
    // Retry mutations once on network error
    retry: shouldRetryMutation,

    // Show error notifications by default
    onError: (error: any) => {
      console.error("Mutation failed:", error);

      // You could integrate with a toast notification system here
      // For example: toast.error(error.message || 'Something went wrong');
    },
  },
};

// Create the query client with our configuration
export const queryClient = new QueryClient({
  defaultOptions: defaultQueryOptions,
});

// Query client utilities for common operations
export const queryUtils = {
  // Clear all cached data (useful on logout)
  clearAll: () => {
    queryClient.clear();
  },

  // Invalidate all queries (force refetch)
  invalidateAll: () => {
    queryClient.invalidateQueries();
  },

  // Prefetch common user data on login
  prefetchUserData: async () => {
    const queries = [
      {
        queryKey: ["profiles"],
        queryFn: () => fetch("/api/v1/user/search-profile/").then((r) => r.json()),
      },
      {
        queryKey: ["interests"],
        queryFn: () => fetch("/api/v1/user/interests/").then((r) => r.json()),
      },
      // {
      //   queryKey: ['favorites'],
      //   queryFn: () => fetch('/api/v1/pois/favourites').then(r => r.json()),
      // },
    ];

    await Promise.all(
      queries.map((query) =>
        queryClient.prefetchQuery({
          ...query,
          staleTime: 10 * 60 * 1000, // 10 minutes
        }),
      ),
    );
  },

  // Remove all user-related data (useful on logout)
  removeUserData: () => {
    const userDataKeys = ["profiles", "interests", "tags", "favorites", "lists", "settings"];
    userDataKeys.forEach((key) => {
      queryClient.removeQueries({ queryKey: [key] });
    });
  },

  // Get cached data without triggering a fetch
  getCachedData: <T>(queryKey: readonly unknown[]): T | undefined => {
    return queryClient.getQueryData<T>(queryKey);
  },

  // Set cached data manually
  setCachedData: <T>(queryKey: readonly unknown[], data: T) => {
    queryClient.setQueryData(queryKey, data);
  },

  // Check if a query is currently loading
  isLoading: (queryKey: readonly unknown[]): boolean => {
    const query = queryClient.getQueryState(queryKey);
    return query?.status === "pending";
  },

  // Check if a query has an error
  hasError: (queryKey: readonly unknown[]): boolean => {
    const query = queryClient.getQueryState(queryKey);
    return query?.status === "error";
  },

  // Get error for a specific query
  getError: (queryKey: readonly unknown[]): Error | null => {
    const query = queryClient.getQueryState(queryKey);
    return query?.error || null;
  },

  // Force refetch a specific query
  refetch: (queryKey: readonly unknown[]) => {
    queryClient.invalidateQueries({ queryKey });
  },

  // Cancel all outgoing queries (useful when navigating away)
  cancelQueries: () => {
    queryClient.cancelQueries();
  },
};

// Error handling utilities
export const errorUtils = {
  // Check if error is network related
  isNetworkError: (error: any): boolean => {
    return error instanceof TypeError && error.message.includes("fetch");
  },

  // Check if error is API related
  isAPIError: (error: any): error is APIError => {
    return error instanceof APIError;
  },

  // Get user-friendly error message
  getErrorMessage: (error: any): string => {
    if (errorUtils.isAPIError(error)) {
      return error.message;
    }

    if (errorUtils.isNetworkError(error)) {
      return "Network connection problem. Please check your internet connection.";
    }

    if (error?.message) {
      return error.message;
    }

    return "An unexpected error occurred. Please try again.";
  },

  // Check if error should trigger logout
  shouldLogout: (error: any): boolean => {
    return errorUtils.isAPIError(error) && error.status === 401;
  },
};

// Performance monitoring utilities
export const performanceUtils = {
  // Log slow queries for debugging
  logSlowQueries: (threshold: number = 3000) => {
    queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.state?.dataUpdatedAt && event?.query?.state?.dataUpdateCount) {
        const duration = Date.now() - (event.query.state.dataUpdatedAt || 0);
        if (duration > threshold) {
          console.warn(`Slow query detected:`, {
            queryKey: event.query.queryKey,
            duration: `${duration}ms`,
            updateCount: event.query.state.dataUpdateCount,
          });
        }
      }
    });
  },

  // Get cache statistics
  getCacheStats: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    return {
      totalQueries: queries.length,
      activeQueries: queries.filter((q) => q.getObserversCount() > 0).length,
      staleQueries: queries.filter((q) => q.isStale()).length,
      errorQueries: queries.filter((q) => q.state.status === "error").length,
      cacheSize: JSON.stringify(cache).length, // Rough estimate
    };
  },
};

// Offline support utilities
export const offlineUtils = {
  // Check if browser is online
  isOnline: () => navigator.onLine,

  // Setup offline/online event listeners
  setupOfflineSupport: () => {
    const handleOnline = () => {
      queryClient.resumePausedMutations();
      queryClient.invalidateQueries();
    };

    const handleOffline = () => {
      // Queries will automatically pause when offline
      console.info("App is offline. Queries will resume when back online.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  },

  // Get offline-capable query options
  getOfflineQueryOptions: () => ({
    networkMode: "offlineFirst" as const,
    staleTime: Infinity, // Keep offline data fresh
    gcTime: 24 * 60 * 60 * 1000, // Keep offline data for 24 hours
  }),
};

// Development utilities
export const devUtils = {
  // Log all query state changes (development only)
  enableQueryLogger: () => {
    if (import.meta.env.DEV) {
      queryClient.getQueryCache().subscribe((event) => {
        console.log("Query updated:", {
          queryKey: event?.query?.queryKey,
          status: event?.query?.state?.status,
          data: event?.query?.state?.data,
        });
      });

      queryClient.getMutationCache().subscribe((event) => {
        console.log("Mutation updated:", {
          mutationKey: event?.mutation?.options?.mutationKey,
          status: event?.mutation?.state?.status,
          variables: event?.mutation?.state?.variables,
        });
      });
    }
  },

  // Get detailed query information for debugging
  getQueryDebugInfo: (queryKey: readonly unknown[]) => {
    const query = queryClient.getQueryCache().find({ queryKey });
    return {
      queryKey,
      state: query?.state,
      observers: query?.getObserversCount(),
      isStale: query?.isStale(),
      lastUpdated: query?.state?.dataUpdatedAt,
      fetchStatus: query?.state?.fetchStatus,
    };
  },
};

// Export configured query client as default
export default queryClient;
