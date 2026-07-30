import { ConnectError, Code } from "@connectrpc/connect";

/**
 * Does this session-restore failure mean the session is actually dead?
 *
 * Only an `Unauthenticated` response does. Everything else - the API being
 * down, a cold start, a network blip, a CORS misconfiguration - is transient.
 *
 * This distinction is the whole bug: `AuthProvider.onMount` used to treat any
 * thrown error as a dead session and call `clearAuthToken()`, so a momentarily
 * unreachable server destroyed perfectly valid tokens and the user was signed
 * out by the act of refreshing the page.
 *
 * Note that the Connect transport has already made one refresh attempt before
 * an `Unauthenticated` reaches us, so by the time this returns true the refresh
 * token has genuinely been rejected.
 */
export function isDeadSession(error: unknown): boolean {
  return error instanceof ConnectError && error.code === Code.Unauthenticated;
}
