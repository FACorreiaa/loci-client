/* ============================================================
   createItineraryStream — reactive 3-phase itinerary engine.

   Phase 1  skeleton    text-only stops, rendered instantly (<500ms)
   Phase 2  enrichment   per-stop { place_id, image_url, rating } patched
                         in place, keyed by id — only the touched card
                         re-reads, the list never re-renders.
   Phase 3  done         stream closed.

   Solid note: we hold stops in a `createStore`. Patching a single
   field (`setState("stops", i, "imageUrl", url)`) mutates that row's
   proxy *in place*. The array reference and every other row reference
   stay identical, so <For> does NOT recreate any DOM — only the
   fine-grained accessor for that one field updates. That is the whole
   trick behind jank-free enrichment.
   ============================================================ */

import { createStore, produce } from "solid-js/store";
import type { AiCityResponse, POIDetailedInfo } from "@/lib/api/types";

export type StreamPhase = "idle" | "skeleton" | "enriching" | "done" | "error";

export interface ItineraryStop {
  /** Stable key. Prefer place_id once known; falls back to slug+index. */
  key: string;
  name: string;
  category?: string;
  blurb?: string;
  priority?: number;
  /**
   * Which day of the plan this stop belongs to, 0-based to match trip-kit.
   * Undefined when the server did not say, which is the signal to group by
   * chunking instead.
   */
  day?: number;
  timeToSpend?: string;
  budget?: string;
  distance?: number;
  /* --- enrichment payload (undefined until phase 2 reaches it) --- */
  placeId?: string;
  imageUrl?: string;
  rating?: number;
  /** true once this stop has received its enrichment chunk. */
  enriched: boolean;
  /** true if enrichment explicitly failed for this stop. */
  failed?: boolean;
}

export interface ItineraryState {
  phase: StreamPhase;
  title: string;
  summary: string;
  stops: ItineraryStop[];
  /** count of stops that have been enriched — drives the progress rail. */
  enrichedCount: number;
  error?: string;
}

export interface SkeletonPayload {
  title?: string;
  summary?: string;
  stops: Array<{
    name: string;
    category?: string;
    blurb?: string;
    priority?: number;
    timeToSpend?: string;
    budget?: string;
    distance?: number;
    key?: string;
  }>;
}

export interface EnrichPayload {
  /** match by key, or by zero-based index if key absent. */
  key?: string;
  index?: number;
  placeId?: string;
  imageUrl?: string;
  rating?: number;
  failed?: boolean;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function createItineraryStream() {
  const [state, setState] = createStore<ItineraryState>({
    phase: "idle",
    title: "",
    summary: "",
    stops: [],
    enrichedCount: 0,
    error: undefined,
  });

  /** Phase 1 — lay down the text skeleton. Instant paint. */
  const setSkeleton = (payload: SkeletonPayload) => {
    const stops: ItineraryStop[] = payload.stops.map((s, i) => ({
      key: s.key || `${slug(s.name) || "stop"}-${i}`,
      name: s.name,
      category: s.category,
      blurb: s.blurb,
      priority: s.priority,
      timeToSpend: s.timeToSpend,
      budget: s.budget,
      distance: s.distance,
      enriched: false,
    }));
    setState(
      produce((d) => {
        d.title = payload.title ?? d.title;
        d.summary = payload.summary ?? d.summary;
        d.stops = stops;
        d.enrichedCount = 0;
        d.phase = "enriching";
        d.error = undefined;
      }),
    );
  };

  const indexForPatch = (p: EnrichPayload): number => {
    if (typeof p.index === "number") return p.index;
    if (p.key) return state.stops.findIndex((s) => s.key === p.key);
    if (p.placeId) return state.stops.findIndex((s) => s.placeId === p.placeId);
    return -1;
  };

  /** Phase 2 — patch one stop in place. The only mutation per chunk. */
  const enrich = (p: EnrichPayload) => {
    const i = indexForPatch(p);
    if (i < 0 || i >= state.stops.length) return;
    const wasEnriched = state.stops[i].enriched;
    setState("stops", i, (prev) => ({
      ...prev,
      placeId: p.placeId ?? prev.placeId,
      imageUrl: p.imageUrl ?? prev.imageUrl,
      rating: p.rating ?? prev.rating,
      failed: p.failed ?? prev.failed,
      enriched: true,
    }));
    if (!wasEnriched) setState("enrichedCount", (n) => n + 1);
  };

  /** Phase 3 — close out. */
  const done = () => setState("phase", "done");

  const fail = (message: string) =>
    setState(
      produce((d) => {
        d.phase = "error";
        d.error = message;
      }),
    );

  const reset = () =>
    setState(
      produce((d) => {
        d.phase = "idle";
        d.title = "";
        d.summary = "";
        d.stops = [];
        d.enrichedCount = 0;
        d.error = undefined;
      }),
    );

  /* ---------------------------------------------------------------
     SSE consumer — wire this to the Go backend's text/event-stream.
     Expected events (one JSON object per `data:` line):
       { "type": "skeleton", "title", "summary", "stops": [...] }
       { "type": "enrich",  "key"|"index", "place_id", "image_url", "rating" }
       { "type": "done" }
       { "type": "error",   "message" }
     Tolerant of "complete" alias and snake/camel field names.
  --------------------------------------------------------------- */
  const consumeSSE = async (response: Response, signal?: AbortSignal) => {
    if (!response.body) throw new Error("Response has no body");
    setState("phase", "skeleton");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    const handle = (evt: any) => {
      switch (evt.type) {
        case "skeleton":
          setSkeleton({
            title: evt.title ?? evt.itinerary_name,
            summary: evt.summary ?? evt.overall_description,
            stops: (evt.stops ?? evt.items ?? []).map((s: any) => ({
              name: s.name,
              category: s.category,
              blurb: s.blurb ?? s.description_poi ?? s.description,
              priority: s.priority,
              timeToSpend: s.time_to_spend ?? s.timeToSpend,
              budget: s.budget,
              distance: s.distance,
              key: s.key ?? s.id,
            })),
          });
          break;
        case "enrich":
        case "enrichment":
          enrich({
            key: evt.key ?? evt.id,
            index: evt.index,
            placeId: evt.place_id ?? evt.placeId,
            imageUrl: evt.image_url ?? evt.imageUrl,
            rating: evt.rating,
            failed: evt.failed,
          });
          break;
        case "done":
        case "complete":
          done();
          break;
        case "error":
          fail(evt.message ?? "Stream error");
          break;
      }
    };

    try {
      while (true) {
        if (signal?.aborted) break;
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? ""; // keep partial line
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            handle(JSON.parse(data));
          } catch {
            /* ignore non-JSON keepalives */
          }
        }
      }
      if (state.phase !== "error" && state.phase !== "done") done();
    } catch (err: any) {
      if (err?.name !== "AbortError") fail(err?.message ?? "Stream failed");
    } finally {
      reader.releaseLock?.();
    }
  };

  return {
    state,
    setSkeleton,
    enrich,
    done,
    fail,
    reset,
    consumeSSE,
  };
}

/* ===============================================================
   Adapter: turn a whole AiCityResponse (current single-shot backend)
   into the same skeleton → enrich shape, so the editorial UI shows
   the progressive experience today and needs zero changes when the
   backend starts true phased streaming.
   =============================================================== */

export function stopsFromCityResponse(data: AiCityResponse | null): {
  title: string;
  summary: string;
  stops: ItineraryStop[];
  enrichedCount: number;
} {
  const itin = data?.itinerary_response;
  const pois: POIDetailedInfo[] = itin?.points_of_interest ?? data?.points_of_interest ?? [];

  // Day first, then priority within the day. Sorting on priority alone
  // interleaves the day groups, so day two's best place lands above day one's
  // second-best and the headers read as nonsense.
  const sorted = [...pois].sort(
    (a, b) =>
      (a.day ?? Number.MAX_SAFE_INTEGER) - (b.day ?? Number.MAX_SAFE_INTEGER) ||
      (a.priority ?? 999) - (b.priority ?? 999),
  );

  let enrichedCount = 0;
  const stops: ItineraryStop[] = sorted.map((poi, i) => {
    const imageUrl = poi.images?.[0];
    const placeId = poi.id;
    const enriched = Boolean(imageUrl || placeId);
    if (enriched) enrichedCount++;
    return {
      key: placeId || `${slug(poi.name) || "stop"}-${i}`,
      name: poi.name,
      category: poi.category,
      blurb: poi.description_poi || poi.description,
      priority: poi.priority,
      timeToSpend: poi.time_to_spend,
      budget: poi.budget,
      distance: typeof poi.distance === "number" ? poi.distance : undefined,
      // 1-based on the wire, 0-based here: trip-kit labels `Day ${day + 1}`
      // and its free-tier gate unlocks day 0. Converting once, here, is what
      // keeps that gate working untouched.
      day: typeof poi.day === "number" && poi.day > 0 ? poi.day - 1 : undefined,
      placeId,
      imageUrl,
      rating: poi.rating,
      enriched,
    };
  });

  return {
    title: itin?.itinerary_name || "Your itinerary",
    summary: itin?.overall_description || "",
    stops,
    enrichedCount,
  };
}
