// The in-flight stream, readable from any page.
//
// A search on `/` starts a stream on the module-level streamingService, which
// keeps running across navigation. What did NOT survive navigation was the
// subscriber: the page that started the stream owned the callbacks, so the
// moment it unmounted every event went to signals nobody rendered. That is why
// the redirect waited for `complete` — the destination page had nothing to
// bind to before then.
//
// This store is the handoff. streamingService writes into it on every event;
// a destination page checks whether the session id in its URL is the one
// streaming right now and, if so, renders from here instead of waiting for
// sessionStorage or a server round-trip.

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
}

// Not solid-js/web's `isServer`: under vitest the package resolves to its
// server build and reports true even in a happy-dom test, which silently
// no-ops every write. The DOM check answers the question actually being asked.
const isServer = typeof window === "undefined";

const IDLE: LiveStream = {
  sessionId: "",
  requestId: "",
  domain: "general",
  city: "",
  query: "",
  phase: "idle",
  data: null,
  error: null,
  lastEventId: "",
  tokenCount: 0,
  startedAt: 0,
};

const [liveStream, setLiveStream] = createStore<LiveStream>({ ...IDLE });

export { liveStream };

/** Replace fields. No-op during SSR: there is no client stream to describe. */
export function patchLiveStream(patch: Partial<LiveStream>): void {
  if (isServer) return;
  setLiveStream(
    produce((s) => {
      Object.assign(s, patch);
    }),
  );
}

export function resetLiveStream(): void {
  if (isServer) return;
  setLiveStream({ ...IDLE });
}

/**
 * Whether `sessionId` is the stream in flight (or the one that just finished
 * and has not been replaced). A page that lands with this id can render from
 * the store directly.
 */
export function isLiveSession(sessionId: string | undefined | null): boolean {
  if (!sessionId) return false;
  return liveStream.sessionId === sessionId && liveStream.phase !== "idle";
}

/** Reactive accessors for one session id. All false/null when it is not live. */
export function useLiveSession(sessionId: () => string | undefined) {
  const isLive = () => isLiveSession(sessionId());
  return {
    isLive,
    data: () => (isLive() ? liveStream.data : null),
    phase: (): LiveStreamPhase => (isLive() ? liveStream.phase : "idle"),
    error: () => (isLive() ? liveStream.error : null),
    /** True while the server is still producing. */
    isStreaming: () =>
      isLive() && (liveStream.phase === "connecting" || liveStream.phase === "streaming"),
    tokenCount: () => (isLive() ? liveStream.tokenCount : 0),
  };
}

/** Key the resume envelope is persisted under (itinerary/index.tsx reads it). */
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

/** Persist enough to resume after a reload. Data rides along when present. */
export function persistActiveSession(envelope: ActiveSessionEnvelope): void {
  if (isServer) return;
  try {
    sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(envelope));
  } catch {
    /* private mode / quota: resume is best-effort */
  }
}

export function readActiveSession(sessionId: string): ActiveSessionEnvelope | null {
  if (isServer || !sessionId) return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSessionEnvelope;
    return parsed?.sessionId === sessionId ? parsed : null;
  } catch {
    return null;
  }
}

export function clearActiveSession(): void {
  if (isServer) return;
  try {
    sessionStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
