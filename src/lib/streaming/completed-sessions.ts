// Finished sessions, keyed by id, so several searches can finish in one tab
// without each overwriting the last. The single "completedStreamingSession"
// slot is still written for older readers; this map is what restores read
// first.

const KEY = "loci.completedSessions";
const KEEP = 5;

type Entry = { id: string; data: unknown };

function read(): Entry[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCompletedSession(sessionId: string, data: unknown): void {
  if (!sessionId) return;
  const next = [...read().filter((e) => e.id !== sessionId), { id: sessionId, data }].slice(-KEEP);
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota: the server fallback still works */
  }
}

export function loadCompletedSession(sessionId: string): Record<string, unknown> | null {
  const hit = read().find((e) => e.id === sessionId);
  return hit && hit.data && typeof hit.data === "object"
    ? (hit.data as Record<string, unknown>)
    : null;
}
