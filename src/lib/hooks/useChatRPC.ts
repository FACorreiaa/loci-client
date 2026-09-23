import { createStore } from "solid-js/store";
import { DomainType } from "../api/types";
import { getProgressForEventType } from "../utils/chatUtils";
import { parseStreamError } from "../errors";
import type { LociStreamEvent } from "../streaming/chatStream";
import { streamWithReconnect } from "../streaming/reconnect";
import { removeRun, upsertRun } from "../streaming/live-stream-store";
import { saveCompletedSession } from "../streaming/completed-sessions";
import { hydrateSession, sectionFor } from "../streaming/hydrate-session";
import { getDomainRoute, responseHasContent } from "../streaming-service";

export interface ChatRPCState {
  isConnected: boolean;
  isStreaming: boolean;
  error: string | null;
  progress: number;
  currentStep: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>;
  streamedData: any | null;
}

export interface UseChatRPCOptions {
  /**
   * The server named this run. The owning page puts the id in its URL here,
   * so RunWatcher knows the viewer is on the run's page and a reload can
   * restore it.
   */
  onStart?: (sessionId: string) => void;
  onComplete?: (data: any) => void;
  onError?: (error: string) => void;
  onRedirect?: (domain: DomainType, sessionId: string, city: string) => void;
  onProgress?: (data: any) => void;
}

export function useChatRPC(options: UseChatRPCOptions = {}) {
  const [state, setState] = createStore<ChatRPCState>({
    isConnected: false,
    isStreaming: false,
    error: null,
    progress: 0,
    currentStep: "",
    messages: [],
    streamedData: null,
  });

  // This hook's in-flight stream. A new startStream on the same instance
  // supersedes it (/nearme re-searches on a distance change); leaving the page
  // does not, so a search keeps running after you navigate away.
  let inflight: AbortController | null = null;

  const startStream = async (
    message: string,
    cityName?: string,
    userLocation?: { latitude: number; longitude: number },
  ) => {
    inflight?.abort();
    const ctrl = new AbortController();
    inflight = ctrl;

    // Reset state for new chat
    setState({
      isConnected: true,
      isStreaming: true,
      error: null,
      progress: 0,
      currentStep: "Connecting...",
      streamedData: null,
      // Keep previous messages if any (optional, usually cleared for fresh start or appended)
      // For this implementation, let's assume we append or the caller handles message history display
      // But typically this hook manages the *current* streaming session state.
    });

    // Reported to the page-run registry so a result page still knows this
    // run's status after the tab that started it navigates away or reloads.
    let sessionId = "";
    let domain: DomainType = "general";
    let runCity = "";

    try {
      setState({ currentStep: "Processing request...", progress: 10 });

      // Single canonical reader, resumed across dropped connections: a
      // transport failure after `start` reconnects with the session id and
      // last event id (or settles by polling) and never lands in "error".
      // The run stays "streaming" meanwhile. See reconnect.ts.
      for await (const event of streamWithReconnect(
        {
          message,
          cityName,
          userLocation: userLocation
            ? { userLat: userLocation.latitude, userLon: userLocation.longitude }
            : undefined,
        },
        ctrl.signal,
      )) {
        // Superseded: its events (including the error an abort produces)
        // belong to nobody now, and must not overwrite the new run's state.
        if (ctrl.signal.aborted) break;
        switch (event.kind) {
          case "error":
            throw new Error(event.userMessage);

          case "start": {
            sessionId = event.sessionId ?? "";
            domain = (event.domain as DomainType) ?? "general";
            runCity = event.city ?? cityName ?? "";
            const here = pageWithSession(sessionId);
            upsertRun(sessionId, {
              phase: "streaming",
              domain,
              city: runCity,
              query: message,
              source: "page",
              startedAt: Date.now(),
              // Replaced at completion, when the server's navigation tells us
              // the real result page.
              url: here,
              // This page shows the run whatever url the server names later.
              hostPath: here.split("?")[0] + `?sessionId=${encodeURIComponent(sessionId)}`,
            });
            if (sessionId) options.onStart?.(sessionId);
            handleProgress("start");
            break;
          }

          case "progress":
            handleProgress(event.stage);
            break;

          case "token":
          case "partial":
            // Incremental text; callers that want it can read state as needed.
            break;

          case "city_data": {
            const data = { general_city_data: event.city };
            setState({ streamedData: data });
            upsertRun(sessionId, { data });
            handleProgress("city_data", data);
            break;
          }

          case "general_pois":
          case "hotels":
          case "restaurants":
          case "activities": {
            const data = toStreamData(event);
            setState({ streamedData: data });
            upsertRun(sessionId, { data });
            handleProgress(event.kind === "general_pois" ? "nearby" : event.kind, data);
            break;
          }

          case "itinerary": {
            const data = event.cityResponse;
            setState({ streamedData: data });
            upsertRun(sessionId, { data });
            handleProgress("itinerary", data);
            break;
          }

          case "complete": {
            const hasExistingData =
              state.streamedData?.points_of_interest?.length > 0 ||
              state.streamedData?.hotels?.length > 0 ||
              state.streamedData?.restaurants?.length > 0 ||
              state.streamedData?.activities?.length > 0;

            // A resume that found the server's buffer gone: the result is
            // not on the stream, and what arrived before the drop is partial.
            // Load the finished session, the way a reopened page would.
            const fromSession = event.loadFromSession
              ? await hydrateSession(sessionId || event.sessionId, ...sectionFor(domain))
              : null;
            if (ctrl.signal.aborted) break;
            const data = fromSession ?? event.result ?? null;
            setState({
              isStreaming: false,
              isConnected: false,
              progress: 100,
              currentStep: "Complete!",
              streamedData: fromSession
                ? fromSession
                : hasExistingData
                  ? state.streamedData
                  : (data ?? state.streamedData),
            });
            options.onComplete?.(state.streamedData || data);

            upsertRun(sessionId, {
              phase: "complete",
              url: event.navigation?.url || getDomainRoute(domain, sessionId, runCity),
            });
            // A finished run with nothing to show (a zero-valued response, or
            // no data event ever arrived) is not worth caching — it would
            // make a later restore read back as a successful, empty result.
            // hydrateSession already cached what it loaded.
            if (!event.loadFromSession && responseHasContent(state.streamedData)) {
              saveCompletedSession(sessionId, { sessionId, data: state.streamedData });
            }

            if (event.navigation && options.onRedirect) {
              const nav = event.navigation;
              const q = nav.queryParams || {};
              options.onRedirect(
                (q.domain as DomainType) || "general",
                q.sessionId || event.sessionId || "",
                q.cityName || "",
              );
            }
            break;
          }
        }
      }
    } catch (err: any) {
      if (ctrl.signal.aborted) return;
      console.error("RPC Stream Error:", err);

      const parsedError = parseStreamError(err.message || String(err));

      setState({
        error: parsedError.userMessage,
        isStreaming: false,
        isConnected: false,
      });
      if (sessionId) upsertRun(sessionId, { phase: "error", error: parsedError.userMessage });
      options.onError?.(parsedError.userMessage);
    } finally {
      // A superseded run never finishes; unlist it so nothing waits on it.
      if (ctrl.signal.aborted && sessionId) removeRun(sessionId);
      if (inflight === ctrl) inflight = null;
    }
  };

  // This page's URL with `sessionId` set: where the run is shown.
  const pageWithSession = (sessionId: string): string => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    params.set("sessionId", sessionId);
    return `${window.location.pathname}?${params.toString()}`;
  };

  // Shape a domain list event into the streamedData object the UI reads.
  const toStreamData = (
    event: Extract<
      LociStreamEvent,
      { kind: "general_pois" | "hotels" | "restaurants" | "activities" }
    >,
  ): any => {
    const base = { general_city_data: event.city, session_id: event.sessionId };
    switch (event.kind) {
      case "general_pois":
        return { ...base, points_of_interest: event.pois };
      case "hotels":
        return { ...base, hotels: event.pois };
      case "restaurants":
        return { ...base, restaurants: event.pois };
      case "activities":
        return { ...base, activities: event.pois };
    }
  };

  const handleProgress = (type: string, data?: any) => {
    // Use shared progress messages from chatUtils
    const progressInfo = getProgressForEventType(type);

    // Handle special cases
    if (type === "nearby") {
      console.log("[useChatRPC] nearby event received:", data);
      console.log("[useChatRPC] nearby points_of_interest:", data?.points_of_interest);
      setState({
        currentStep: progressInfo.message,
        progress: progressInfo.progress,
        streamedData: data, // Update streamedData with nearby POIs
      });
    } else {
      setState({
        currentStep: progressInfo.message,
        progress: progressInfo.progress,
      });
    }

    // Notify callback for data-bearing events
    if (data && type !== "start") {
      options.onProgress?.(data);
    }
  };

  // setError lets a route report a problem it found for itself — no query to
  // run, or a session id that restores nothing — through the same channel a
  // stream failure uses. The routes previously had no way to do this, so those
  // cases fell through to a bare `return` and rendered an empty panel.
  const setError = (message: string) => {
    setState({
      error: message,
      isStreaming: false,
      isConnected: false,
    });
  };

  return {
    state,
    startStream,
    setError,
  };
}
