// Connect RPC transport configuration for the Loci app
import { createConnectTransport } from "@connectrpc/connect-web";
import { createClient } from "@connectrpc/connect";
import type { Interceptor, Transport } from "@connectrpc/connect";
import { ConnectError, Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { AuthService } from "@buf/loci_loci-proto.bufbuild_es/loci/auth/auth_pb.js";
import { RefreshTokenRequestSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/auth/auth_pb.js";
import {
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  isPersistentSession,
  clearAuthToken,
} from "./auth/tokens";
import { notifyAuthExpired } from "./auth/auth-events";
import { logger } from "./logger";

// Connect RPC base URL (without /api/v1 prefix - Connect appends service paths)
const API_BASE_URL = import.meta.env.VITE_CONNECT_BASE_URL || "http://localhost:8000";

// Bare transport WITHOUT the refresh interceptor, used only to refresh tokens.
// Using the main authenticated transport here would recurse: a 401 from the
// refresh call would re-enter the refresh interceptor.
const refreshTransport = createConnectTransport({ baseUrl: API_BASE_URL });
const refreshClient = createClient(AuthService, refreshTransport);

// Single in-flight refresh shared across all concurrent callers. A search fires
// several RPCs at once; without sharing, each 401 would trigger its own refresh
// (or, worse, race on a nulled promise and be read as "refresh failed").
let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the access token using the refresh token.
 * Returns true if successful, false otherwise.
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    logger.warn("No refresh token available for token refresh");
    return false;
  }

  try {
    const response = await refreshClient.refreshToken(
      create(RefreshTokenRequestSchema, { refreshToken }),
    );

    if (response.accessToken) {
      // Preserve the remember me preference
      const shouldPersist = isPersistentSession();
      setAuthToken(response.accessToken, shouldPersist, response.refreshToken || refreshToken);
      logger.debug("Token refreshed successfully");
      return true;
    }

    return false;
  } catch (error) {
    logger.error("Token refresh error:", error);
    return false;
  }
}

/**
 * Return the shared in-flight refresh promise, starting one if none is running.
 * Capturing the returned promise into a local (rather than re-reading a module
 * flag after an await) is what makes concurrent 401s safe.
 */
function getRefreshPromise(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Shared, deduplicated token refresh. Use from places the unary interceptor
 * can't cover — e.g. server-streaming RPCs, whose 401 surfaces during stream
 * iteration rather than at the initial call. Returns true if the access token
 * was refreshed.
 */
export function refreshSession(): Promise<boolean> {
  return getRefreshPromise();
}

/**
 * Interceptor that adds authentication headers to requests.
 */
const authInterceptor: Interceptor = (next) => async (req) => {
  const token = getAuthToken();
  if (token) {
    req.header.set("Authorization", `Bearer ${token}`);
  }
  return next(req);
};

/**
 * Interceptor that automatically refreshes tokens on 401 Unauthenticated errors.
 * If refresh succeeds, it retries the original request with the new token.
 */
const tokenRefreshInterceptor: Interceptor = (next) => async (req) => {
  try {
    return await next(req);
  } catch (error) {
    // Only handle ConnectError with Unauthenticated code.
    if (error instanceof ConnectError && error.code === Code.Unauthenticated) {
      // Attempt a refresh whenever we hold a refresh token. We no longer match
      // on the error message: a transient 401 mid-search must never fall through
      // to logout just because the server's wording didn't contain "token". If
      // the user isn't logged in there is no refresh token, so we skip and let
      // the original error (e.g. bad credentials on login) propagate untouched.
      if (getRefreshToken()) {
        const refreshed = await getRefreshPromise();

        if (refreshed) {
          // Retry the original request once with the new token.
          const newToken = getAuthToken();
          if (newToken) {
            req.header.set("Authorization", `Bearer ${newToken}`);
          }
          return next(req);
        }

        // Refresh genuinely failed - the session is dead. Clear tokens and
        // signal a soft logout. AuthProvider handles the SPA navigation; we do
        // NOT touch window.location (a full reload wipes in-memory state and is
        // what was logging users out mid-search).
        clearAuthToken();
        notifyAuthExpired();
      }
    }

    // Re-throw the original error
    throw error;
  }
};

/**
 * Creates a Connect transport with authentication and token refresh interceptors.
 * This transport is used by all Connect-Query hooks to make RPC calls.
 */
export function createAuthenticatedTransport(): Transport {
  return createConnectTransport({
    baseUrl: API_BASE_URL,
    // Interceptors run in order: auth first (adds token), then refresh (handles 401)
    interceptors: [authInterceptor, tokenRefreshInterceptor],
  });
}

/**
 * Default transport instance for the application.
 * Export this to use with TransportProvider.
 */
export const transport = createAuthenticatedTransport();
