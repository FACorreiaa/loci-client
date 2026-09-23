// Which search a result page is showing, as one string to key its body on.
//
// Solid Router keeps a route mounted when only the query changes, so Open on
// a toast for /hotels?sessionId=B, while /hotels?sessionId=A is on screen,
// changed the URL and nothing else: the restore/hydrate logic lives in
// onMount and never ran for B. The routes now render their body inside
// <Show when={key()} keyed>, which remounts it whenever the key changes.
//
// The one URL change that must NOT remount: a page that starts its own
// search writes the new session id into its URL (replace) the moment the
// server names it. Remounting then would throw away the component that is
// reading that stream. So the page "adopts" that id first, and the step
// from its query to its own adopted id keeps the key.
import { createMemo, untrack, type Accessor } from "solid-js";

export interface SessionKeyParams {
  sessionId?: string;
  message?: string;
  cityName?: string;
}

export interface SessionKeyState {
  key: string;
  /** The id this page's own search was given, while it is still in the URL. */
  adopted?: string;
}

/** A session, or (before there is one) the query that will start it. */
export function routeKey(params: SessionKeyParams): string {
  if (params.sessionId) return `s:${params.sessionId}`;
  return `q:${params.message ?? ""}|${params.cityName ?? ""}`;
}

/** The next key after a URL change. Pure, so the rule is testable. */
export function stepSessionKey(
  state: SessionKeyState | undefined,
  params: SessionKeyParams,
): SessionKeyState {
  const id = params.sessionId || undefined;
  if (state && id && id === state.adopted) return state;
  return { key: routeKey(params), adopted: undefined };
}

const str = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * The key for a route's body, plus `adopt(id)`, which the page calls with
 * its own run's id just before it writes that id into the URL.
 */
export function createSessionKey(
  params: () => Partial<Record<"sessionId" | "message" | "cityName", string | string[]>>,
): { key: Accessor<string>; adopt: (sessionId: string) => void } {
  const read = (): SessionKeyParams => {
    const p = params();
    return { sessionId: str(p.sessionId), message: str(p.message), cityName: str(p.cityName) };
  };
  let state = stepSessionKey(undefined, untrack(read));
  const key = createMemo<string>(() => {
    state = stepSessionKey(state, read());
    return state.key;
  }, state.key);
  return {
    key,
    adopt: (sessionId: string) => {
      state = { ...state, adopted: sessionId };
    },
  };
}
