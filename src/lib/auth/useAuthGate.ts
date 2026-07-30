import { useAuth } from "~/contexts/AuthContext";
import { getAuthToken } from "./tokens";

/**
 * The single gate every authenticated query should use for its `enabled` flag.
 *
 * Two checks, because they are not equivalent:
 *  - `authReady()` - the session-restore attempt has finished, so a redirect or
 *    a token refresh is no longer in flight.
 *  - `getAuthToken()` - a token is actually readable right now.
 *
 * Firing a query while either is false sends a headerless request, which the
 * server answers with `unauthenticated`. That used to cascade into a refresh
 * attempt and, on failure, a logout - the "opening /discover logged me out"
 * class of bug.
 *
 * Usage:
 *   const gate = useAuthGate();
 *   useQuery(() => ({ ..., enabled: gate() }));
 *
 * Pass `extra` to AND in a caller-supplied condition:
 *   enabled: gate(() => !!cityId())
 */
export function useAuthGate(): (extra?: () => boolean) => boolean {
  // Some call sites (tests, storybook-ish previews) render a query hook outside
  // the provider. Degrade to the token-only check rather than throwing.
  let authReady: () => boolean;
  try {
    authReady = useAuth().authReady;
  } catch {
    authReady = () => true;
  }

  return (extra?: () => boolean) => authReady() && !!getAuthToken() && (extra ? extra() : true);
}

/**
 * Non-reactive variant for modules that cannot call `useAuth()` (outside a
 * component scope). Weaker than `useAuthGate` - it cannot see `authReady` - so
 * prefer the hook wherever a component context exists.
 */
export function hasAuthToken(): boolean {
  return !!getAuthToken();
}
