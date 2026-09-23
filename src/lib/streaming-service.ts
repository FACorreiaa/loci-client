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
import {
  streamChatEvents,
  type ChatStreamParams,
  type LociStreamEvent,
} from "./streaming/chatStream";
import {
  liveRuns,
  persistActiveSession,
  upsertRun,
  type LiveStream,
} from "./streaming/live-stream-store";
import { COMPLETED_SESSION_KEY } from "./streaming/restore-session";
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

const newRequestId = (): string => {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Whether a payload has anything a page could render. The server's `complete`
 * frame decodes to a zero-valued AiCityResponse (only session_id set), and
 * preferring it over the itinerary that arrived a frame earlier wiped the
 * results at the finish line.
 */
export const responseHasContent = (r: Partial<UnifiedChatResponse> | null | undefined): boolean => {
  if (!r || typeof r !== "object") return false;
  const any = r as any;
  if (any.general_city_data?.city) return true;
  const lists = [
    any.points_of_interest,
    any.itinerary_response?.points_of_interest,
    any.hotels,
    any.restaurants,
    any.activities,
  ];
  return lists.some((l) => Array.isArray(l) && l.length > 0);
};

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
      });
    }

    void this.consume({ ...params, requestId: run.requestId }, run);
  }

  /** Stop one run (by session id), or every run. Finalizes the partial
   *  session (onComplete), does not surface an error. */
  public stop(sessionId?: string): void {
    for (const run of this.runs.values()) {
      if (sessionId && run.sessionId !== sessionId) continue;
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
      for await (const event of streamChatEvents(params, run.controller.signal)) {
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
    if (run.sessionId) {
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

    this.finalize(run);

    if (mgr.onRedirect && mgr.session.data) {
      mgr.onRedirect(mgr.session.domain, mgr.session.data as UnifiedChatResponse);
    }
  }

  private handleStreamComplete(run: Run): void {
    if (run.manager.session.isComplete) return;
    // Stream ended without an explicit complete event — finalize anyway.
    this.finalize(run);
  }

  /**
   * The one place a finished session is recorded: the store flips to
   * `complete`, and the payload goes to sessionStorage for the reload path
   * (restore-session.ts reads it back). Callers used to each write this
   * themselves — three copies, two key shapes.
   */
  private finalize(run: Run): void {
    const s = run.manager.session;
    s.isComplete = true;
    this.publish(run, { phase: "complete" });
    if (s.sessionId) {
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
