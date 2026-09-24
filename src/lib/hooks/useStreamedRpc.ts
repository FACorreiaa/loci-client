// src/lib/hooks/useStreamedRpc.ts
//
// The itinerary page's own search: the one it starts from `?message=…&cityName=…`,
// which is also where a toast's Retry lands.
//
// It used to open a private stream, abort it in onCleanup and never list it,
// so walking away from the page killed a search the server was still paying
// for — silently, with no toast. It now runs on the shared streamingService,
// the way a search from the dashboard does: the run outlives the page, is
// listed in the live store (so RunWatcher announces how it ended), survives a
// reload through its resume envelope, and reconnects after a dropped
// connection (reconnect.ts). This hook only mirrors that run into the store
// the page renders.
import { createStore } from "solid-js/store";
import { createStreamingSession, streamingService } from "@/lib/streaming-service";
import { upsertRun } from "@/lib/streaming/live-stream-store";
import { responseHasContent } from "@/lib/streaming/response-content";
import { AiCityResponse } from "~/lib/api/types";
import type { RouteInfo } from "~/lib/streaming/chatStream";
import type { StopState } from "~/lib/streaming/multi-city";

/** One city of a multi-city search, as the stop builder hands it over. */
export type StopInput = { cityName: string; nights?: number };

type StreamedRpcOptions = {
  /**
   * The server named the run. The page puts the id in its URL here, so
   * RunWatcher knows the viewer is on the run's page and a reload restores it.
   */
  onStart?: (sessionId: string) => void;
  onData?: (_: AiCityResponse) => void;
  onComplete?: (meta?: { tripId?: string }) => void;
  onError?: (_: Error) => void;
};

/** The page this run is shown on, whatever url the server names later. */
export const itineraryHostPath = (sessionId: string): string =>
  `/itinerary?sessionId=${encodeURIComponent(sessionId)}`;

export function useStreamedRpc(
  message: () => string,
  cityName: () => string,
  profileId: () => string,
  opts: StreamedRpcOptions = {},
  // A multi-city search from the stop builder; two or more stops need no city.
  stops: () => StopInput[] | undefined = () => undefined,
  suggestOrder: () => boolean = () => false,
) {
  const [store, setStore] = createStore<{
    data: AiCityResponse | null;
    error: Error | null;
    isLoading: boolean;
    tripId: string | null;
    /** A multi-city run's route and cities; null / empty for one city. */
    route: RouteInfo | null;
    stops: StopState[];
  }>({
    data: null,
    error: null,
    isLoading: false,
    tripId: null,
    route: null,
    stops: [],
  });

  // This hook's run, by request id. A second connect() (the page's Try again)
  // supersedes it; unmounting the page does not.
  let current: string | null = null;

  const connect = async () => {
    const multi = (stops()?.length ?? 0) >= 2;
    if (!message() || (!cityName() && !multi)) {
      return;
    }
    if (current) streamingService.stop(current);

    setStore("isLoading", true);
    setStore("error", null);
    setStore("tripId", null);
    setStore("route", null);
    setStore("stops", []);

    const requestId = `itinerary-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    current = requestId;
    const mine = () => current === requestId;

    const session = createStreamingSession("itinerary");
    session.query = message();
    session.city = cityName();

    const mirrorRoute = (s: { route?: RouteInfo; stops?: StopState[] }) => {
      if (!mine() || !s.route) return;
      setStore("route", s.route);
      setStore("stops", s.stops ?? []);
    };

    const mirror = (data: unknown) => {
      if (!mine() || !responseHasContent(data as AiCityResponse)) return;
      setStore("data", data as AiCityResponse);
      opts.onData?.(data as AiCityResponse);
    };

    streamingService.startStream(
      {
        message: message(),
        cityName: cityName() || undefined,
        profileId: profileId() || undefined,
        requestId,
        stops: multi ? stops() : undefined,
        suggestOrder: multi ? suggestOrder() : undefined,
      },
      {
        session,
        onStart: (s) => {
          if (!mine() || !s.sessionId) return;
          upsertRun(s.sessionId, { hostPath: itineraryHostPath(s.sessionId) });
          opts.onStart?.(s.sessionId);
        },
        onProgress: (s) => {
          mirrorRoute(s);
          mirror(s.data);
        },
        onComplete: (s) => {
          if (!mine()) return;
          current = null;
          mirrorRoute(s);
          mirror(s.data);
          if (s.tripId) setStore("tripId", s.tripId);
          setStore("isLoading", false);
          opts.onComplete?.(s.tripId ? { tripId: s.tripId } : undefined);
        },
        onError: (message) => {
          if (!mine()) return;
          current = null;
          const err = new Error(message);
          setStore("error", err);
          setStore("isLoading", false);
          opts.onError?.(err);
          opts.onComplete?.(undefined);
        },
      },
    );
  };

  return { store, connect, setStore };
}
