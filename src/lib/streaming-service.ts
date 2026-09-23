// Streaming service for the unified chat API.
//
// This consumes the ONE canonical stream reader (streamChatEvents) — which reads
// the typed proto oneof directly — and projects normalized events onto a
// StreamingSession, preserving the manager callback contract that useChat relies
// on (onProgress / onComplete / onError / onRedirect).
//
// The previous implementation hand-rolled an SSE text parser plus a
// brace-counting JSON accumulator (chunkBuffer) because structured data used to
// arrive as buffered LLM text chunks. Structured data now arrives as typed
// events, so all of that machinery is gone.

import type {
  StreamingSession,
  DomainType,
  UnifiedChatResponse,
  AiCityResponse,
  AccommodationResponse,
  DiningResponse,
  ActivitiesResponse,
  HotelDetailedInfo,
  RestaurantDetailedInfo,
} from "./api/types";
import type { ChatStreamParams, LociStreamEvent } from "./streaming/chatStream";
import { streamWithReconnect } from "./streaming/reconnect";
import {
  clearActiveSession,
  liveRuns,
  persistActiveSession,
  removeRun,
  upsertRun,
  type LiveStream,
} from "./streaming/live-stream-store";
import { COMPLETED_SESSION_KEY } from "./streaming/restore-session";
import { responseHasContent } from "./streaming/response-content";
import { saveCompletedSession } from "./streaming/completed-sessions";
import { logger } from "./logger";

export interface StreamingSessionManager {
  session: StreamingSession;
  /**
   * The server has minted a session id (and told us the domain it detected).
   * Fired once. This is the moment to navigate: everything a results route
   * needs to bind to the live stream is known, and the stream keeps running
   * after the caller unmounts.
   */
  onStart?: (session: StreamingSession) => void;
  onProgress: (session: StreamingSession) => void;
  onComplete: (session: StreamingSession) => void;
  onError: (error: string) => void;
  onRedirect?: (domain: DomainType, data: UnifiedChatResponse) => void;
  /**
   * The page that renders this run inline while it streams, when that is not
   * its result page (/chat). RunWatcher treats it as the run's own page.
   */
  hostPath?: string;
  /** Every normalized stream event, before it is projected onto the session. */
  onEvent?: (event: LociStreamEvent) => void;
}

/** One in-flight stream: its manager and the controller that can stop it. */
interface Run {
  manager: StreamingSessionManager;
  controller: AbortController;
  requestId: string;
  /** Empty until the server's `start` names it (or a resume supplies it). */
  sessionId: string;
  profileId?: string;
  query: string;
  aborted: boolean;
  started: boolean;
}

export const newRequestId = (): string => {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export { responseHasContent };

export class StreamingChatService {
  // Every stream in flight, keyed by request id: a fresh search has no
  // session id until the server's `start` event mints one.
  private runs = new Map<string, Run>();

  constructor() {}

  /**
   * Open a chat stream for the given request and drive the manager callbacks.
   * Other runs keep going: each has its own manager, controller and store
   * entry, so a second search no longer stops the first.
   */
  public startStream(params: ChatStreamParams, manager: StreamingSessionManager): void {
    const run: Run = {
      manager,
      controller: new AbortController(),
      requestId: params.requestId ?? newRequestId(),
      sessionId: params.sessionId ?? "",
      profileId: params.profileId,
      query: params.message,
      aborted: false,
      started: false,
    };
    this.runs.set(run.requestId, run);

    // A fresh search has no key yet; it is listed on `start`. A resume knows
    // its session id, so the page can bind before the server replays.
    if (run.sessionId) {
      upsertRun(run.sessionId, {
        requestId: run.requestId,
        domain: manager.session.domain,
        city: manager.session.city ?? "",
        query: params.message,
        phase: "connecting",
        // A resume hands back what the envelope saved, so the page has
        // something to show while the server replays.
        data: responseHasContent(manager.session.data) ? manager.session.data : null,
        error: null,
        lastEventId: params.resumeToken ?? "",
        tokenCount: 0,
        startedAt: Date.now(),
        source: "service",
        url: getDomainRoute(manager.session.domain, run.sessionId, manager.session.city),
        ...(manager.hostPath ? { hostPath: manager.hostPath } : {}),
      });
    }

    void this.consume({ ...params, requestId: run.requestId }, run);
  }

  /** Stop one run (by session id, or by request id before the server has
   *  named it), or every run. Hands the partial session to onComplete, does
   *  not surface an error, and unlists the run: a stopped search did not
   *  finish, so nothing announces it or saves it as a result. */
  public stop(id?: string): void {
    for (const run of this.runs.values()) {
      if (id && run.sessionId !== id && run.requestId !== id) continue;
      run.aborted = true;
      run.controller.abort();
    }
  }

  /** Patch this run's store entry, once it has a session id to key it by. */
  private live(run: Run, patch: Partial<LiveStream>): void {
    if (run.sessionId) upsertRun(run.sessionId, patch);
  }

  private async consume(params: ChatStreamParams, run: Run): Promise<void> {
    try {
      // A dropped connection resumes this same run (same manager, same store
      // entry) instead of failing it: see reconnect.ts.
      for await (const event of streamWithReconnect(params, run.controller.signal)) {
        if (run.aborted) break;
        this.project(event, run);
      }
      this.handleStreamComplete(run);
    } catch (error) {
      if (run.aborted) {
        this.handleStreamComplete(run);
        return;
      }
      logger.error("Stream processing error:", error);
      run.manager.onError(`Stream error: ${error}`);
      this.live(run, { phase: "error", error: String(error) });
      if (run.sessionId) clearActiveSession(run.sessionId);
    } finally {
      this.runs.delete(run.requestId);
    }
  }

  /** Mirror the session into this run's store entry and resume envelope. */
  private publish(run: Run, extra: Partial<LiveStream> = {}): void {
    const s = run.manager.session;
    this.live(run, {
      domain: s.domain,
      city: s.city ?? "",
      data: s.data ?? null,
      ...extra,
    });
    // A finished run has nothing to resume. Writing its envelope here, after
    // live() has already let RunWatcher announce and clear it, left it on
    // disk, and the next reload announced the same run again.
    const finished = extra.phase === "complete" || extra.phase === "error";
    if (run.sessionId && !finished) {
      const entry = liveRuns[run.sessionId];
      persistActiveSession({
        sessionId: run.sessionId,
        requestId: run.requestId,
        profileId: run.profileId,
        lastEventId: entry?.lastEventId ?? "",
        query: run.query,
        domain: s.domain,
        city: s.city ?? "",
        startedAt: entry?.startedAt ?? Date.now(),
        data: s.data ?? null,
      });
    }
  }

  // Project a normalized event onto the session and fire callbacks.
  private project(event: LociStreamEvent, run: Run): void {
    const mgr = run.manager;
    const isCity = mgr.session.domain === "general" || mgr.session.domain === "itinerary";
    // `start` names the run; key it first so its own event id is recorded.
    if (event.kind === "start" && event.sessionId) run.sessionId = event.sessionId;
    if (event.eventId) this.live(run, { lastEventId: event.eventId });
    mgr.onEvent?.(event);

    switch (event.kind) {
      case "start":
        if (event.sessionId) mgr.session.sessionId = event.sessionId;
        if (event.domain) mgr.session.domain = event.domain as DomainType;
        if (event.city) mgr.session.city = event.city;
        if (mgr.session.sessionId) run.sessionId = mgr.session.sessionId;
        this.publish(run, {
          phase: "streaming",
          url: getDomainRoute(mgr.session.domain, run.sessionId, mgr.session.city),
          source: "service",
          requestId: run.requestId,
          query: run.query,
          ...(mgr.hostPath ? { hostPath: mgr.hostPath } : {}),
          // A resume keeps the time its entry was created with.
          startedAt: liveRuns[run.sessionId]?.startedAt ?? Date.now(),
        });
        if (!run.started) {
          run.started = true;
          mgr.onStart?.(mgr.session);
        }
        mgr.onProgress(mgr.session);
        break;

      case "token":
      case "partial":
        // Incremental text is never rendered: three workers stream JSON
        // fragments into one channel with no part label. It only proves the
        // server is still writing.
        this.live(run, { tokenCount: (liveRuns[run.sessionId]?.tokenCount ?? 0) + 1 });
        mgr.onProgress(mgr.session);
        break;

      case "city_data":
        if (isCity && event.city) {
          const data = (mgr.session.data ?? {}) as Partial<AiCityResponse>;
          data.general_city_data = event.city;
          data.session_id = mgr.session.sessionId;
          mgr.session.data = { ...data };
        }
        if (event.city?.city) mgr.session.city = event.city.city;
        this.publish(run);
        mgr.onProgress(mgr.session);
        break;

      case "general_pois":
        if (isCity) {
          const data = (mgr.session.data ?? {}) as Partial<AiCityResponse>;
          data.points_of_interest = event.pois;
          if (event.city) data.general_city_data = event.city;
          mgr.session.data = { ...data };
        }
        this.publish(run);
        mgr.onProgress(mgr.session);
        break;

      case "itinerary":
        // The itinerary event carries the full aggregate city response.
        mgr.session.data = event.cityResponse;
        if (event.cityResponse.general_city_data?.city) {
          mgr.session.city = event.cityResponse.general_city_data.city;
        }
        this.publish(run);
        mgr.onProgress(mgr.session);
        break;

      case "hotels":
        if (event.city?.city) mgr.session.city = event.city.city;
        mgr.session.data = {
          general_city_data: event.city,
          // Slice 1: hotels are POI-shaped end-to-end (see chatStream.ts).
          hotels: event.pois as unknown as HotelDetailedInfo[],
          domain: "accommodation",
          session_id: event.sessionId || mgr.session.sessionId,
        } as AccommodationResponse;
        this.publish(run);
        mgr.onProgress(mgr.session);
        break;

      case "restaurants":
        if (event.city?.city) mgr.session.city = event.city.city;
        mgr.session.data = {
          general_city_data: event.city,
          restaurants: event.pois as unknown as RestaurantDetailedInfo[],
          domain: "dining",
          session_id: event.sessionId || mgr.session.sessionId,
        } as DiningResponse;
        this.publish(run);
        mgr.onProgress(mgr.session);
        break;

      case "activities":
        if (event.city?.city) mgr.session.city = event.city.city;
        mgr.session.data = {
          general_city_data: event.city,
          activities: event.pois,
          domain: "activities",
          session_id: event.sessionId || mgr.session.sessionId,
        } as ActivitiesResponse;
        this.publish(run);
        mgr.onProgress(mgr.session);
        break;

      case "progress":
        mgr.onProgress(mgr.session);
        break;

      case "error":
        mgr.session.error = event.userMessage;
        this.live(run, { phase: "error", error: event.userMessage });
        if (run.sessionId) clearActiveSession(run.sessionId);
        mgr.onError(event.userMessage);
        break;

      case "complete":
        this.handleComplete(event, run);
        break;
    }
  }

  private handleComplete(event: Extract<LociStreamEvent, { kind: "complete" }>, run: Run): void {
    const mgr = run.manager;
    if (mgr.session.isComplete) return; // guard double-complete

    // Prefer the aggregate on the complete event only when it has content.
    if (event.result && responseHasContent(event.result)) {
      mgr.session.data = event.result;
      if (event.result.general_city_data?.city) {
        mgr.session.city = event.result.general_city_data.city;
      }
    }
    if (event.sessionId) mgr.session.sessionId = event.sessionId;
    if (!run.sessionId && mgr.session.sessionId) run.sessionId = mgr.session.sessionId;
    if (event.tripId) mgr.session.tripId = event.tripId;

    this.finalize(run, {
      url: event.navigation?.url,
      loadFromSession: event.loadFromSession,
    });

    if (mgr.onRedirect && mgr.session.data) {
      mgr.onRedirect(mgr.session.domain, mgr.session.data as UnifiedChatResponse);
    }
  }

  private handleStreamComplete(run: Run): void {
    const s = run.manager.session;
    if (s.isComplete) return;
    if (run.aborted) {
      this.abandon(run);
      return;
    }
    // streamChatEvents reports a failure as a final `error` event and then
    // returns. That run failed; finalizing it here flipped it to complete
    // and saved its partial data as a result.
    if (s.error) return;
    // Stream ended without an explicit complete event — finalize anyway.
    this.finalize(run);
  }

  /**
   * A stopped run. Its caller still gets the partial session (useChat's Stop
   * turns it into the answer shown in the chat), but the run is unlisted and
   * its envelope dropped: no `complete` phase, no toast, no completed-session
   * save that a later restore would read back as a finished result.
   */
  private abandon(run: Run): void {
    const s = run.manager.session;
    s.isComplete = true;
    if (run.sessionId) {
      removeRun(run.sessionId);
      clearActiveSession(run.sessionId);
    }
    run.manager.onComplete(s);
  }

  /**
   * The one place a finished session is recorded: the store flips to
   * `complete`, and the payload goes to sessionStorage for the reload path
   * (restore-session.ts reads it back). Callers used to each write this
   * themselves — three copies, two key shapes.
   */
  private finalize(run: Run, end: { url?: string; loadFromSession?: boolean } = {}): void {
    const s = run.manager.session;
    s.isComplete = true;
    // A run that never saw `start` has no url yet; notifications link to it.
    // The server's own url (a resume settled by GetRunStatus) wins.
    const url = end.url || (run.sessionId ? getDomainRoute(s.domain, run.sessionId, s.city) : "");
    this.publish(run, {
      phase: "complete",
      ...(url ? { url } : {}),
      // The result was not on the stream (a resume after the server's buffer
      // was gone): whatever arrived before the drop is partial. Listing no
      // data makes pages load the session from the server instead.
      ...(end.loadFromSession ? { data: null } : {}),
    });
    if (run.sessionId) clearActiveSession(run.sessionId);
    if (s.sessionId && !end.loadFromSession) {
      try {
        sessionStorage.setItem(COMPLETED_SESSION_KEY, JSON.stringify(s));
      } catch {
        /* private mode / quota */
      }
      saveCompletedSession(s.sessionId, s);
    }
    run.manager.onComplete(s);
  }

  // Clean up resources
  public cleanup(): void {
    this.stop();
    this.runs.clear();
  }
}

// Helper function to create a streaming session
export const createStreamingSession = (domain: DomainType = "general"): StreamingSession => {
  return {
    sessionId: "",
    domain,
    data: {},
    isComplete: false,
  };
};

// Helper function to get route path based on domain
export const getDomainRoute = (domain: DomainType, sessionId?: string, city?: string): string => {
  let baseRoute: string;

  switch (domain) {
    case "itinerary":
    case "general":
      baseRoute = "/itinerary";
      break;
    case "accommodation":
      baseRoute = "/hotels";
      break;
    case "dining":
      baseRoute = "/restaurants";
      break;
    case "activities":
      baseRoute = "/activities";
      break;
    default:
      baseRoute = "/itinerary";
      break;
  }

  // Add query parameters if provided
  const params = new URLSearchParams();
  if (sessionId) params.append("sessionId", sessionId);
  if (city) params.append("cityName", city);
  if (domain) params.append("domain", domain);

  const queryString = params.toString();
  return queryString ? `${baseRoute}?${queryString}` : baseRoute;
};

// Export singleton instance
export const streamingService = new StreamingChatService();
