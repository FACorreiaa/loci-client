// src/lib/streaming/chatStream.ts
//
// THE single chat stream reader. Consumes the ChatService.StreamChat server
// stream (a typed AsyncIterable<StreamEvent>) directly and maps each event's
// typed `payload` oneof onto a normalized, discriminated `LociStreamEvent`.
//
// This replaces the five ad-hoc SSE/text parsers that previously existed
// (streaming-service.ts, useChatSession.ts, discover.tsx, useStreamedRpc.ts, and
// the convertProtoStreamToSSE bridge in llm.ts). There is no text/SSE round-trip
// anymore — Connect already hands us decoded protobuf messages.
//
// Resume safety: events are deduplicated by `eventId`, so replaying an
// interrupted stream via `resumeToken` never double-emits tokens.

import { create } from "@bufbuild/protobuf";
import { ConnectError, Code } from "@connectrpc/connect";
import {
  ChatRequestSchema,
  StreamEventType,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import type { StreamEvent as ProtoStreamEvent } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { chatService } from "@/lib/api";
import { refreshSession } from "@/lib/connect-transport";
import { parseStreamError } from "@/lib/errors";
import { mapAiCityResponse, mapGeneralCityData, mapPoi } from "@/lib/api/llm";
import { mapCityGastronomy } from "@/lib/api/gastronomy";
import type {
  AiCityResponse,
  CityGastronomy,
  GeneralCityData,
  POIDetailedInfo,
} from "@/lib/api/types";
import { capture } from "~/lib/analytics";
import { logger } from "~/lib/logger";
import { domainName } from "./domain-name";

export interface NavigationInfo {
  url: string;
  routeType: string;
  queryParams: Record<string, string>;
}

// Normalized, UI-facing stream event. One shape per proto oneof case.
// `eventId` is the server's frame id when it sent one — the resume token a
// reconnect hands back so the server replays from there.
/** One city of a multi-city stream (proto StopRef). */
export interface RouteStop {
  index: number;
  cityName: string;
  cityId?: string;
  sessionId: string;
  /** Trip-wide day numbers spent in this city. */
  dayNumbers: number[];
}

/** Travel between two cities of a multi-city trip (proto TripLeg). An estimate. */
export interface RouteLeg {
  afterDay: number;
  fromName: string;
  toName: string;
  distanceKm: number;
  durationMins: number;
  mode: string;
  fromLat?: number;
  fromLon?: number;
  toLat?: number;
  toLon?: number;
}

/** A multi-city stream's route (proto RoutePayload). */
export interface RouteInfo {
  stops: RouteStop[];
  legs: RouteLeg[];
  outline: string;
  warnings: string[];
  dropped: { cityName: string; reason: string }[];
  totalTravelMins: number;
  /** The parent trip, once the server has saved it. */
  tripId?: string;
}

// `stopIndex` is set on every per-city event of a multi-city stream; an
// `error` carrying it failed that city only.
export type LociStreamEvent = { eventId?: string; stopIndex?: number } & (
  | { kind: "start"; sessionId: string; domain: string; city?: string }
  | { kind: "token"; text: string }
  | { kind: "partial"; text: string }
  | { kind: "city_data"; city?: GeneralCityData; sessionId: string }
  | { kind: "itinerary"; cityResponse: AiCityResponse }
  | { kind: "general_pois"; pois: POIDetailedInfo[]; city?: GeneralCityData; sessionId: string }
  | { kind: "hotels"; pois: POIDetailedInfo[]; city?: GeneralCityData; sessionId: string }
  | { kind: "restaurants"; pois: POIDetailedInfo[]; city?: GeneralCityData; sessionId: string }
  | { kind: "activities"; pois: POIDetailedInfo[]; city?: GeneralCityData; sessionId: string }
  | { kind: "gastronomy"; gastronomy: CityGastronomy; sessionId: string }
  | { kind: "progress"; stage: string; percent?: number }
  | { kind: "route"; route: RouteInfo }
  | {
      kind: "error";
      userMessage: string;
      internalCode: string;
      retryable: boolean;
      retryAfterMs?: number;
      /**
       * The connection failed, not the search: the fetch never got through,
       * or the stream died before a terminal event. The server keeps
       * generating after a client disconnects, so this run may well finish;
       * see reconnect.ts. Never set on a StreamError the server sent.
       */
      transport?: boolean;
      /** The transport's own message, for diagnostics. Not shown to people. */
      detail?: string;
    }
  | {
      kind: "complete";
      sessionId: string;
      result?: AiCityResponse;
      navigation?: NavigationInfo;
      tripId?: string;
      /**
       * A resume whose server buffer was gone but whose run had finished: the
       * result is not on this stream. Load it with GetChatSession /
       * GetSessionPOIs.
       */
      loadFromSession?: boolean;
    }
);

export interface ChatStreamParams {
  message: string;
  profileId?: string;
  sessionId?: string;
  cityName?: string;
  userLocation?: { userLat: number; userLon: number };
  /** Present on reconnect: server replays from the last acked event. */
  resumeToken?: string;
  /** Client-generated idempotency/correlation id echoed back on events. */
  requestId?: string;
  /** A multi-city trip from the stop builder, in the traveller's order. */
  stops?: { cityName: string; nights?: number }[];
  /** Let the server reorder `stops` into a sensible route. */
  suggestOrder?: boolean;
}

const mapNavigation = (nav: ProtoStreamEvent["navigation"]): NavigationInfo | undefined =>
  nav ? { url: nav.url, routeType: nav.routeType, queryParams: nav.queryParams ?? {} } : undefined;

/** Prefer queryParams.tripId; fall back to /trips/:id path on navigation URL. */
function tripIdFromNavigation(nav: ProtoStreamEvent["navigation"]): string | undefined {
  if (!nav) return undefined;
  const fromQuery = nav.queryParams?.tripId?.trim();
  if (fromQuery) return fromQuery;
  const m = nav.url?.match(/\/trips\/([^/?#]+)/);
  return m?.[1];
}

/**
 * Map a decoded proto StreamEvent onto a normalized event. Returns null for
 * keepalive/unknown frames the UI should ignore. Malformed structured payloads
 * degrade to a progress/error event rather than throwing, so one bad frame
 * never kills the stream.
 */
export function mapProtoEvent(ev: ProtoStreamEvent): LociStreamEvent | null {
  const out = mapPayload(ev);
  if (out && ev.stopIndex !== undefined) out.stopIndex = ev.stopIndex;
  return out;
}

function mapPayload(ev: ProtoStreamEvent): LociStreamEvent | null {
  const p = ev.payload;
  switch (p.case) {
    case "route":
      return {
        kind: "route",
        route: {
          stops: p.value.stops.map((s) => ({
            index: s.index,
            cityName: s.cityName,
            cityId: s.cityId || undefined,
            sessionId: s.sessionId,
            dayNumbers: [...s.dayNumbers],
          })),
          legs: p.value.legs.map((l) => ({
            afterDay: l.afterDay,
            fromName: l.fromName,
            toName: l.toName,
            distanceKm: l.distanceKm,
            durationMins: l.durationMins,
            mode: l.mode,
            fromLat: l.fromLat,
            fromLon: l.fromLon,
            toLat: l.toLat,
            toLon: l.toLon,
          })),
          outline: p.value.outline,
          warnings: [...p.value.warnings],
          dropped: p.value.dropped.map((d) => ({ cityName: d.cityName, reason: d.reason })),
          totalTravelMins: p.value.totalTravelMins,
          tripId: p.value.tripId || undefined,
        },
      };
    case "start":
      return {
        kind: "start",
        sessionId: p.value.sessionId,
        domain: domainName(p.value.domain),
        city: p.value.cityName,
      };
    case "token":
      return { kind: "token", text: p.value.text };
    case "partial":
      return { kind: "partial", text: p.value.text };
    case "cityData":
      return {
        kind: "city_data",
        city: mapGeneralCityData(p.value.generalCityData),
        sessionId: p.value.sessionId,
      };
    case "itinerary": {
      const cityResponse = mapAiCityResponse(p.value.cityResponse);
      if (!cityResponse) {
        return {
          kind: "error",
          userMessage: "Received an empty itinerary.",
          internalCode: "empty_itinerary",
          retryable: false,
        };
      }
      return { kind: "itinerary", cityResponse };
    }
    case "generalPois":
      return {
        kind: "general_pois",
        pois: (p.value.pois ?? []).map(mapPoi),
        city: mapGeneralCityData(p.value.generalCityData),
        sessionId: p.value.sessionId,
      };
    case "hotels":
      return {
        kind: "hotels",
        pois: (p.value.pois ?? []).map(mapPoi),
        city: mapGeneralCityData(p.value.generalCityData),
        sessionId: p.value.sessionId,
      };
    case "restaurants":
      return {
        kind: "restaurants",
        pois: (p.value.pois ?? []).map(mapPoi),
        city: mapGeneralCityData(p.value.generalCityData),
        sessionId: p.value.sessionId,
      };
    case "activities":
      return {
        kind: "activities",
        pois: (p.value.activities ?? []).map(mapPoi),
        city: mapGeneralCityData(p.value.generalCityData),
        sessionId: p.value.sessionId,
      };
    case "gastronomy": {
      const gastronomy = mapCityGastronomy(p.value.gastronomy);
      // An empty section is not worth an event: the page keeps waiting.
      if (!gastronomy) return null;
      return { kind: "gastronomy", gastronomy, sessionId: p.value.sessionId };
    }
    case "progress":
      return { kind: "progress", stage: p.value.stage, percent: p.value.percent };
    case "error":
      return {
        kind: "error",
        userMessage: p.value.userMessage,
        internalCode: p.value.internalCode,
        retryable: p.value.retryable,
        retryAfterMs: p.value.retryAfterMs,
      };
    case "complete":
      return {
        kind: "complete",
        sessionId: p.value.sessionId,
        result: mapAiCityResponse(p.value.result),
        navigation: mapNavigation(ev.navigation),
        tripId: tripIdFromNavigation(ev.navigation),
        ...(p.value.loadFromSession ? { loadFromSession: true } : {}),
      };
    default:
      // No structured payload — fall back to the event_type discriminator for
      // bodiless frames (complete/progress keepalives), else ignore.
      switch (ev.eventType) {
        case StreamEventType.COMPLETE:
          return {
            kind: "complete",
            sessionId: "",
            navigation: mapNavigation(ev.navigation),
            tripId: tripIdFromNavigation(ev.navigation),
          };
        case StreamEventType.PROGRESS:
          return { kind: "progress", stage: ev.message || "progress" };
        default:
          return null;
      }
  }
}

/** What this client can render, sent on every stream (server: featuresHeader). */
export const CLIENT_FEATURES = { "Loci-Features": "multi-city" } as const;

export const buildRequest = (params: ChatStreamParams) =>
  // These are `optional` fields with a min_len:1 validator. Sending "" POPULATES
  // them (proto3 optional tracks presence), so the server rejects the request on
  // validation. Omit empties (undefined) so they stay unpopulated and are skipped.
  create(ChatRequestSchema, {
    message: params.message,
    cityName: params.cityName || undefined,
    profileId: params.profileId || undefined,
    sessionId: params.sessionId || undefined,
    resumeToken: params.resumeToken || undefined,
    requestId: params.requestId || undefined,
    stops: (params.stops ?? []).map((s) => ({ cityName: s.cityName, nights: s.nights })),
    suggestOrder: params.suggestOrder ?? false,
    userLocation: params.userLocation
      ? { latitude: params.userLocation.userLat, longitude: params.userLocation.userLon }
      : undefined,
  });

/**
 * The canonical stream. Yields normalized events. Deduplicates by eventId (so a
 * resumed stream never double-emits), and performs a one-shot token refresh +
 * reopen if the stream fails Unauthenticated before emitting anything. Any other
 * terminal error is surfaced as a final `error` event (never thrown), so callers
 * have a single, total contract to consume.
 *
 * A failure of the connection itself — and a stream that simply stops before
 * `complete` or `error` — is marked `transport: true`, so callers can resume
 * the run rather than declare it failed (reconnect.ts).
 */
export async function* streamChatEvents(
  params: ChatStreamParams,
  signal?: AbortSignal,
): AsyncGenerator<LociStreamEvent> {
  const req = buildRequest(params);
  // Tells the server this client renders multi-city streams (ROUTE and
  // stop_index); without it free text naming several cities stays one city.
  const makeStream = () => chatService.streamChat(req, { signal, headers: CLIENT_FEATURES });

  const seen = new Set<string>();
  let emitted = false;
  let terminal = false;

  async function* iterate(src: AsyncIterable<ProtoStreamEvent>): AsyncGenerator<LociStreamEvent> {
    for await (const ev of src) {
      if (ev.eventId) {
        if (seen.has(ev.eventId)) continue; // drop replayed duplicates
        seen.add(ev.eventId);
      }
      const mapped = mapProtoEvent(ev);
      if (mapped) {
        emitted = true;
        // A city's error in a multi-city stream is not the end of it.
        if (
          mapped.kind === "complete" ||
          (mapped.kind === "error" && mapped.stopIndex === undefined)
        )
          terminal = true;
        if (ev.eventId) mapped.eventId = ev.eventId;
        yield mapped;
      }
    }
  }

  // The server always ends a stream on `complete` or `error`. One that just
  // stops was cut off on the way (a proxy, the browser, the network).
  const endedEarly = (): Extract<LociStreamEvent, { kind: "error" }> | null =>
    terminal || signal?.aborted
      ? null
      : {
          kind: "error",
          userMessage: "The connection dropped before the search finished.",
          internalCode: "stream_ended",
          retryable: true,
          transport: true,
        };

  try {
    yield* iterate(makeStream());
    const early = endedEarly();
    if (early) yield early;
  } catch (err) {
    const connErr = err instanceof ConnectError ? err : undefined;
    if (!emitted && connErr?.code === Code.Unauthenticated && (await refreshSession())) {
      try {
        yield* iterate(makeStream());
        const early = endedEarly();
        if (early) yield early;
        return;
      } catch (retryErr) {
        reportMapperError(retryErr);
        const re = retryErr instanceof ConnectError ? retryErr : undefined;
        if (!signal?.aborted && isTransportFailure(retryErr)) {
          yield { ...terminalError(re, retryErr), transport: true, retryable: true };
          return;
        }
        yield {
          kind: "error",
          userMessage: parseStreamError(re?.rawMessage ?? String(retryErr)).userMessage,
          internalCode: re ? Code[re.code] : "unknown",
          retryable: false,
        };
        return;
      }
    }
    reportMapperError(err);
    const final = terminalError(connErr, err);
    // Our own abort is a stop, not a dropped connection.
    if (!signal?.aborted && isTransportFailure(err)) {
      yield { ...final, transport: true, retryable: true };
      return;
    }
    yield final;
  }
}

/**
 * Whether a thrown stream failure came from the connection rather than from
 * the server's answer. Connect reports a browser-level drop (fetch rejected,
 * HTTP/2 stream reset, body read failed) as Unknown/Internal/Unavailable, and
 * a request cancelled by something other than our own AbortSignal (a proxy,
 * the browser) as Canceled — callers rule our own abort out first. Everything
 * else — Unauthenticated, ResourceExhausted, InvalidArgument,
 * PermissionDenied — is the server's decision and resuming cannot change it.
 *
 * A raw TypeError is not one of these: connect-es already wraps a failed
 * fetch as Unknown, so a TypeError reaching here is our own mapping code
 * throwing (see reportMapperError). Resuming would replay into the same bug.
 */
export function isTransportFailure(err: unknown): boolean {
  if (!(err instanceof ConnectError)) return false;
  return (
    err.code === Code.Unavailable ||
    err.code === Code.Unknown ||
    err.code === Code.Internal ||
    err.code === Code.Canceled
  );
}

/** A bare TypeError out of the stream is a bug in this file's mapping, not a network drop. */
function reportMapperError(err: unknown): void {
  if (!(err instanceof TypeError)) return;
  logger.error("stream mapper error", err);
  capture("stream_mapper_error", { message: err.message.slice(0, 200) });
}

/**
 * The final `error` event for a stream that failed to open or died.
 *
 * ResourceExhausted means two different things here. About quota or a rate
 * limit, parseStreamError words it. Otherwise it is the server's concurrent
 * search cap, whose message is already written for people ("You have 3
 * searches running — wait for one to finish"): it passes through verbatim,
 * and retrying cannot help until one of those searches ends.
 */
export function terminalError(
  connErr: ConnectError | undefined,
  err: unknown,
): Extract<LociStreamEvent, { kind: "error" }> {
  const raw = connErr?.rawMessage ?? String(err);
  const internalCode = connErr ? Code[connErr.code] : "unknown";
  if (connErr?.code === Code.ResourceExhausted && !/quota|rate.?limit|429/i.test(raw)) {
    return { kind: "error", userMessage: raw.trim(), internalCode, retryable: false };
  }
  return {
    kind: "error",
    userMessage: parseStreamError(raw).userMessage,
    internalCode,
    retryable: connErr?.code === Code.Unavailable || connErr?.code === Code.ResourceExhausted,
    detail: raw,
  };
}

export interface ChatStreamHandlers {
  onEvent?: (e: LociStreamEvent) => void;
  onStart?: (e: Extract<LociStreamEvent, { kind: "start" }>) => void;
  onToken?: (text: string) => void;
  onItinerary?: (r: AiCityResponse) => void;
  onPois?: (
    e: Extract<LociStreamEvent, { kind: "general_pois" | "hotels" | "restaurants" | "activities" }>,
  ) => void;
  onProgress?: (e: Extract<LociStreamEvent, { kind: "progress" }>) => void;
  onError?: (e: Extract<LociStreamEvent, { kind: "error" }>) => void;
  onComplete?: (e: Extract<LociStreamEvent, { kind: "complete" }>) => void;
}

/**
 * Convenience consumer: iterates streamChatEvents and dispatches to handlers.
 * Callers that want raw control can iterate streamChatEvents directly.
 */
export async function consumeChatStream(
  params: ChatStreamParams,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  for await (const e of streamChatEvents(params, signal)) {
    handlers.onEvent?.(e);
    switch (e.kind) {
      case "start":
        handlers.onStart?.(e);
        break;
      case "token":
      case "partial":
        handlers.onToken?.(e.text);
        break;
      case "itinerary":
        handlers.onItinerary?.(e.cityResponse);
        break;
      case "general_pois":
      case "hotels":
      case "restaurants":
      case "activities":
        handlers.onPois?.(e);
        break;
      case "progress":
        handlers.onProgress?.(e);
        break;
      case "error":
        handlers.onError?.(e);
        break;
      case "complete":
        // Metric: finished itinerary. Fired here rather than in each caller
        // because this is the one place every stream completion passes through.
        capture("itinerary_finished", {
          city: e.result?.general_city_data?.city,
          hasTrip: Boolean(e.tripId),
        });
        handlers.onComplete?.(e);
        break;
    }
  }
}
