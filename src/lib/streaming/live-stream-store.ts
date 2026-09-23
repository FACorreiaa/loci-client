// The in-flight streams, readable from any page.
//
// A search on `/` starts a stream on the module-level streamingService, which
// keeps running across navigation. What did NOT survive navigation was the
// subscriber: the page that started the stream owned the callbacks, so the
// moment it unmounted every event went to signals nobody rendered. That is why
// the redirect waited for `complete` — the destination page had nothing to
// bind to before then.
//
// This store is the handoff. streamingService writes into it on every event;
// a destination page checks whether the session id in its URL is one of the
// runs streaming right now (up to MAX_RUNS at once) and, if so, renders from
// here instead of waiting for sessionStorage or a server round-trip.

import { createStore, produce } from "solid-js/store";
import type { DomainType, UnifiedChatResponse } from "../api/types";

export type LiveStreamPhase = "idle" | "connecting" | "streaming" | "complete" | "error";

export interface LiveStream {
  sessionId: string;
  requestId: string;
  domain: DomainType;
  city: string;
  query: string;
  phase: LiveStreamPhase;
  data: Partial<UnifiedChatResponse> | null;
  error: string | null;
  /** Last event id seen; the resume token for a reconnect. */
  lastEventId: string;
  /** Raw token events so far. Never rendered; drives a "writing" pulse. */
  tokenCount: number;
  startedAt: number;
  /** The page that shows this run's result. */
  url: string;
  /** Who reads the stream: the shared service, or a page's own useChatRPC. */
  source: "service" | "page";
}

// Not solid-js/web's `isServer`: under vitest the package resolves to its
// server build and reports true even in a happy-dom test, which silently
// no-ops every write. The DOM check answers the question actually being asked.
const isServer = typeof window === "undefined";

/** How many searches may stream at once. */
export const MAX_RUNS = 3;

const blank = (sessionId: string): LiveStream => ({
  sessionId,
  requestId: "",
  domain: "general",
  city: "",
  query: "",
  phase: "idle",
  data: null,
  error: null,
  lastEventId: "",
  tokenCount: 0,
  startedAt: Date.now(),
  url: "",
  source: "service",
});

// Every run the service (or a page) is reading, keyed by session id. A run
// with no session id yet (the server has not sent `start`) is not listed.
const [liveRuns, setLiveRuns] = createStore<Record<string, LiveStream>>({});

export { liveRuns };

/** Create or patch one run. No-op during SSR: there is no client stream. */
export function upsertRun(sessionId: string, patch: Partial<LiveStream>): void {
  if (isServer || !sessionId) return;
  setLiveRuns(
    produce((runs) => {
      runs[sessionId] = Object.assign(runs[sessionId] ?? blank(sessionId), patch);
    }),
  );
}

export function removeRun(sessionId: string): void {
  if (isServer) return;
  setLiveRuns(produce((runs) => void delete runs[sessionId]));
}

/**
 * Whether `sessionId` is a run in flight (or one that finished and is still
 * listed). A page that lands with this id can render from the store directly.
 */
export function isLiveSession(sessionId: string | undefined | null): boolean {
  if (!sessionId) return false;
  const run = liveRuns[sessionId];
  return Boolean(run && run.phase !== "idle");
}

/** Reactive accessors for one session id. All false/null when it is not live. */
export function useLiveSession(sessionId: () => string | undefined) {
  const run = () => {
    const id = sessionId();
    return id && isLiveSession(id) ? liveRuns[id] : null;
  };
  return {
    isLive: () => run() !== null,
    data: () => run()?.data ?? null,
    phase: (): LiveStreamPhase => run()?.phase ?? "idle",
    error: () => run()?.error ?? null,
    /** True while the server is still producing. */
    isStreaming: () => {
      const p = run()?.phase;
      return p === "connecting" || p === "streaming";
    },
    tokenCount: () => run()?.tokenCount ?? 0,
  };
}

/** Key the resume envelopes are persisted under (itinerary/index.tsx reads it). */
export const ACTIVE_SESSION_KEY = "active_streaming_session";

export interface ActiveSessionEnvelope {
  sessionId: string;
  requestId: string;
  profileId?: string;
  lastEventId: string;
  query: string;
  domain: DomainType;
  city: string;
  startedAt: number;
  data?: Partial<UnifiedChatResponse> | null;
}

function readEnvelopes(): ActiveSessionEnvelope[] {
  if (isServer) return [];
  try {
    const raw = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Before multi-run, one envelope was stored bare.
    return Array.isArray(parsed) ? parsed : parsed?.sessionId ? [parsed] : [];
  } catch {
    return [];
  }
}

function writeEnvelopes(list: ActiveSessionEnvelope[]): void {
  try {
    sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(list.slice(-MAX_RUNS)));
  } catch {
    /* private mode / quota: resume is best-effort */
  }
}

/** Persist enough to resume after a reload, one envelope per run. */
export function persistActiveSession(envelope: ActiveSessionEnvelope): void {
  if (isServer) return;
  writeEnvelopes([...readEnvelopes().filter((e) => e.sessionId !== envelope.sessionId), envelope]);
}

export function readActiveSession(sessionId: string): ActiveSessionEnvelope | null {
  if (!sessionId) return null;
  return readEnvelopes().find((e) => e.sessionId === sessionId) ?? null;
}

export function readActiveSessions(): ActiveSessionEnvelope[] {
  return readEnvelopes();
}

/** Drop one run's envelope, or (no id) every one. */
export function clearActiveSession(sessionId?: string): void {
  if (isServer) return;
  if (!sessionId) {
    try {
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  writeEnvelopes(readEnvelopes().filter((e) => e.sessionId !== sessionId));
}
