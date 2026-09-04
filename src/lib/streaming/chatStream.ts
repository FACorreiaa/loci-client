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
  DomainType,
  StreamEventType,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import type { StreamEvent as ProtoStreamEvent } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { chatService } from "@/lib/api";
import { refreshSession } from "@/lib/connect-transport";
import { parseStreamError } from "@/lib/errors";
import { mapAiCityResponse, mapGeneralCityData, mapPoi } from "@/lib/api/llm";
import type { AiCityResponse, GeneralCityData, POIDetailedInfo } from "@/lib/api/types";
import { capture } from "~/lib/analytics";

export interface NavigationInfo {
  url: string;
  routeType: string;
  queryParams: Record<string, string>;
}

// Normalized, UI-facing stream event. One shape per proto oneof case.
export type LociStreamEvent =
  | { kind: "start"; sessionId: string; domain: string; city?: string }
  | { kind: "token"; text: string }
  | { kind: "partial"; text: string }
  | { kind: "city_data"; city?: GeneralCityData; sessionId: string }
  | { kind: "itinerary"; cityResponse: AiCityResponse }
  | { kind: "general_pois"; pois: POIDetailedInfo[]; city?: GeneralCityData; sessionId: string }
  | { kind: "hotels"; pois: POIDetailedInfo[]; city?: GeneralCityData; sessionId: string }
  | { kind: "restaurants"; pois: POIDetailedInfo[]; city?: GeneralCityData; sessionId: string }
  | { kind: "activities"; pois: POIDetailedInfo[]; city?: GeneralCityData; sessionId: string }
  | { kind: "progress"; stage: string; percent?: number }
  | {
      kind: "error";
      userMessage: string;
      internalCode: string;
      retryable: boolean;
      retryAfterMs?: number;
    }
  | {
      kind: "complete";
      sessionId: string;
      result?: AiCityResponse;
      navigation?: NavigationInfo;
      tripId?: string;
    };

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
}

const domainName = (d: DomainType): string => {
  switch (d) {
    case DomainType.ACCOMMODATION:
      return "accommodation";
    case DomainType.DINING:
      return "dining";
    case DomainType.ACTIVITIES:
      return "activities";
    case DomainType.ITINERARY:
      return "itinerary";
    case DomainType.TRANSPORT:
      return "transport";
    default:
      return "general";
  }
};

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
  const p = ev.payload;
  switch (p.case) {
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

const buildRequest = (params: ChatStreamParams) =>
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
 */
export async function* streamChatEvents(
  params: ChatStreamParams,
  signal?: AbortSignal,
): AsyncGenerator<LociStreamEvent> {
  const req = buildRequest(params);
  const makeStream = () => chatService.streamChat(req, signal ? { signal } : undefined);

  const seen = new Set<string>();
  let emitted = false;

  async function* iterate(src: AsyncIterable<ProtoStreamEvent>): AsyncGenerator<LociStreamEvent> {
    for await (const ev of src) {
      if (ev.eventId) {
        if (seen.has(ev.eventId)) continue; // drop replayed duplicates
        seen.add(ev.eventId);
      }
      const mapped = mapProtoEvent(ev);
      if (mapped) {
        emitted = true;
        yield mapped;
      }
    }
  }

  try {
    yield* iterate(makeStream());
  } catch (err) {
    const connErr = err instanceof ConnectError ? err : undefined;
    if (!emitted && connErr?.code === Code.Unauthenticated && (await refreshSession())) {
      try {
        yield* iterate(makeStream());
        return;
      } catch (retryErr) {
        const re = retryErr instanceof ConnectError ? retryErr : undefined;
        yield {
          kind: "error",
          userMessage: parseStreamError(re?.rawMessage ?? String(retryErr)).userMessage,
          internalCode: re ? Code[re.code] : "unknown",
          retryable: false,
        };
        return;
      }
    }
    yield {
      kind: "error",
      userMessage: parseStreamError(connErr?.rawMessage ?? String(err)).userMessage,
      internalCode: connErr ? Code[connErr.code] : "unknown",
      retryable: connErr?.code === Code.Unavailable || connErr?.code === Code.ResourceExhausted,
    };
  }
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
