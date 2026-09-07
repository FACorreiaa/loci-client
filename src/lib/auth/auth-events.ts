// Lightweight pub/sub so non-component modules (e.g. the Connect transport
// interceptor) can signal that the session has expired without reaching for
// window.location. AuthProvider subscribes and performs a soft, SPA-friendly
// logout (clear tokens + router navigate) instead of a full page reload that
// wipes in-memory state.

const AUTH_EXPIRED_EVENT = "loci:auth-expired";
const AUTH_ESTABLISHED_EVENT = "loci:auth-established";

/**
 * Signal that the current session is no longer valid (refresh genuinely failed).
 * Safe to call from any module; no-op during SSR.
 */
export function notifyAuthExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

/**
 * Subscribe to session-expired notifications. Returns an unsubscribe function.
 */
export function onAuthExpired(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(AUTH_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
}

/**
 * Signal that a session now exists — a token has just been stored.
 *
 * This channel is why signing up with Google used to leave you on the landing
 * page until you refreshed. `isAuthenticated()` is derived from AuthContext's
 * in-memory `user` signal, and only three things set it: onMount (page load
 * only), `establishSession` (login and MFA), and the `storage` event — which by
 * specification never fires in the tab that wrote the value. The OAuth
 * mutations write tokens and stop, so tokens existed while `user` was still
 * null and the route gate rendered the public page.
 *
 * Emitted from `setAuthToken` rather than from each caller, so every path that
 * obtains a token becomes reactive once: OAuth sign-in, OAuth sign-up, and
 * anything added later.
 *
 * Delivery is deferred by a microtask on purpose. `establishSession` calls
 * `setAuthToken` and then sets `user` synchronously; a synchronous event would
 * run between those two statements, see no user, and fetch the profile a second
 * time for a session that was already established. Deferring lets the caller
 * finish, so a subscriber's "only if there is no user" guard means something.
 *
 * Safe to call from any module; no-op during SSR.
 */
export function notifyAuthEstablished(): void {
  if (typeof window === "undefined") return;
  queueMicrotask(() => {
    // Re-check: the module may be torn down between scheduling and running.
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(AUTH_ESTABLISHED_EVENT));
  });
}

/**
 * Subscribe to session-established notifications. Returns an unsubscribe
 * function.
 */
export function onAuthEstablished(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(AUTH_ESTABLISHED_EVENT, listener);
  return () => window.removeEventListener(AUTH_ESTABLISHED_EVENT, listener);
}
