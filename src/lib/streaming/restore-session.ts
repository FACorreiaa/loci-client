// Shared restore path for the list routes (/activities, /hotels,
// /restaurants).
//
// Each of them inlined the same block, and each carried the same two bugs
// with it:
//
//   - `createStreamingSession` seeds `data: {}`, an empty object is truthy,
//     and the guard was `if (!data)`. A stream that produced no structured
//     result still counted as a successful restore, so nothing was in flight,
//     no error was set, and the panel shimmered forever.
//   - a session id that matched nothing in storage fell through to a bare
//     `return` — no fetch, no error, no loading flag — leaving a completely
//     empty panel.
//
// Both are fixed here once rather than three times.

/** The key streaming-service writes a finished session under. */
export const COMPLETED_SESSION_KEY = "completedStreamingSession";

/**
 * hasListContent reports whether a payload is worth rendering.
 *
 * Results under `listKey` count, and so does city data on its own — a city
 * with nothing to show is still an answer, and the header names the place.
 * An empty object is not.
 */
export function hasListContent(data: unknown, listKey: string): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  const list = record[listKey];
  if (Array.isArray(list) && list.length > 0) return true;
  return Boolean(record.general_city_data);
}

/**
 * readCompletedSession returns the payload stored for `sessionId`, or null if
 * storage holds nothing, holds something unparseable, or holds a different
 * session's results.
 *
 * The session id is checked against both the envelope (`sessionId`) and the
 * payload (`session_id`) because the two write paths disagree about where it
 * lives.
 */
export function readCompletedSession(sessionId: string): Record<string, unknown> | null {
  if (!sessionId) return null;

  let raw: string | null;
  try {
    raw = sessionStorage.getItem(COMPLETED_SESSION_KEY);
  } catch {
    // Private-mode Safari throws on access rather than returning null.
    return null;
  }
  if (!raw) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to parse completed streaming session:", e);
    return null;
  }

  const data = (parsed?.data ?? parsed) as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return null;
  if (parsed?.sessionId !== sessionId && data.session_id !== sessionId) return null;

  return data;
}
