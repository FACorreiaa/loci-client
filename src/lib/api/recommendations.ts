import { create } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  GetPersonalizationSettingsRequestSchema,
  GetTasteProfileRequestSchema,
  PersonalizationSettings as ProtoPersonalizationSettings,
  RecommendationChannel,
  RecommendationEventSchema,
  RecommendationEventType,
  RecommendationService,
  RecommendationSurface,
  type RecommendationTrace as ProtoRecommendationTrace,
  RecommendationTraceSchema,
  RecordEventsRequestSchema,
  ResetTasteProfileRequestSchema,
  TasteProfile as ProtoTasteProfile,
  UpdatePersonalizationSettingsRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/recommendation/recommendation_pb.js";
import { createClient } from "@connectrpc/connect";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { getAuthToken } from "../auth/tokens";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const recommendationClient = createClient(RecommendationService, transport);

export type RecommendationSurfaceName =
  | "RECOMMENDATION_SURFACE_DISCOVER"
  | "RECOMMENDATION_SURFACE_NEARBY"
  | "RECOMMENDATION_SURFACE_CHAT"
  | "RECOMMENDATION_SURFACE_TRIP"
  | "RECOMMENDATION_SURFACE_PLACE";

export type RecommendationChannelName = "RECOMMENDATION_CHANNEL_WEB" | "RECOMMENDATION_CHANNEL_MCP";

export type RecommendationEventName =
  | "RECOMMENDATION_EVENT_TYPE_DELIVERED"
  | "RECOMMENDATION_EVENT_TYPE_PRESENTED"
  | "RECOMMENDATION_EVENT_TYPE_OPENED"
  | "RECOMMENDATION_EVENT_TYPE_DISMISSED"
  | "RECOMMENDATION_EVENT_TYPE_FAVORITED"
  | "RECOMMENDATION_EVENT_TYPE_ADDED_TO_LIST"
  | "RECOMMENDATION_EVENT_TYPE_ADDED_TO_TRIP"
  | "RECOMMENDATION_EVENT_TYPE_KEPT_IN_TRIP"
  | "RECOMMENDATION_EVENT_TYPE_REMOVED_FROM_TRIP"
  | "RECOMMENDATION_EVENT_TYPE_EXPORTED"
  | "RECOMMENDATION_EVENT_TYPE_BOOKING_OPENED"
  | "RECOMMENDATION_EVENT_TYPE_VISIT_CONFIRMED"
  | "RECOMMENDATION_EVENT_TYPE_RATED";

export interface RecommendationTrace {
  runId: string;
  itemId: string;
  rank: number;
  algorithmVersion: string;
  experimentVariant: string;
  surface: RecommendationSurfaceName;
  channel: RecommendationChannelName;
}

export interface RecommendationEvent {
  eventType: RecommendationEventName;
  trace: RecommendationTrace;
  poiId?: string;
  tripId?: string;
  rating?: number;
  metadata?: Record<string, string>;
}

export interface PersonalizationSettings {
  personalizationEnabled: boolean;
  contributeAggregate: boolean;
  disclosureSeen: boolean;
  updatedAt: string;
}

export interface TasteProfile {
  traits: Array<{
    key: string;
    label: string;
    score: number;
    confidence: number;
    evidenceCount: number;
  }>;
  feedbackCount: number;
  algorithmVersion: string;
  lastFeedbackAt?: string;
  updatedAt: string;
}

const surfaces: Record<RecommendationSurfaceName, RecommendationSurface> = {
  RECOMMENDATION_SURFACE_DISCOVER: RecommendationSurface.DISCOVER,
  RECOMMENDATION_SURFACE_NEARBY: RecommendationSurface.NEARBY,
  RECOMMENDATION_SURFACE_CHAT: RecommendationSurface.CHAT,
  RECOMMENDATION_SURFACE_TRIP: RecommendationSurface.TRIP,
  RECOMMENDATION_SURFACE_PLACE: RecommendationSurface.PLACE,
};

const channels: Record<RecommendationChannelName, RecommendationChannel> = {
  RECOMMENDATION_CHANNEL_WEB: RecommendationChannel.WEB,
  RECOMMENDATION_CHANNEL_MCP: RecommendationChannel.MCP,
};

const eventTypes: Record<RecommendationEventName, RecommendationEventType> = {
  RECOMMENDATION_EVENT_TYPE_DELIVERED: RecommendationEventType.DELIVERED,
  RECOMMENDATION_EVENT_TYPE_PRESENTED: RecommendationEventType.PRESENTED,
  RECOMMENDATION_EVENT_TYPE_OPENED: RecommendationEventType.OPENED,
  RECOMMENDATION_EVENT_TYPE_DISMISSED: RecommendationEventType.DISMISSED,
  RECOMMENDATION_EVENT_TYPE_FAVORITED: RecommendationEventType.FAVORITED,
  RECOMMENDATION_EVENT_TYPE_ADDED_TO_LIST: RecommendationEventType.ADDED_TO_LIST,
  RECOMMENDATION_EVENT_TYPE_ADDED_TO_TRIP: RecommendationEventType.ADDED_TO_TRIP,
  RECOMMENDATION_EVENT_TYPE_KEPT_IN_TRIP: RecommendationEventType.KEPT_IN_TRIP,
  RECOMMENDATION_EVENT_TYPE_REMOVED_FROM_TRIP: RecommendationEventType.REMOVED_FROM_TRIP,
  RECOMMENDATION_EVENT_TYPE_EXPORTED: RecommendationEventType.EXPORTED,
  RECOMMENDATION_EVENT_TYPE_BOOKING_OPENED: RecommendationEventType.BOOKING_OPENED,
  RECOMMENDATION_EVENT_TYPE_VISIT_CONFIRMED: RecommendationEventType.VISIT_CONFIRMED,
  RECOMMENDATION_EVENT_TYPE_RATED: RecommendationEventType.RATED,
};

const surfaceNames: Partial<Record<RecommendationSurface, RecommendationSurfaceName>> = {
  [RecommendationSurface.DISCOVER]: "RECOMMENDATION_SURFACE_DISCOVER",
  [RecommendationSurface.NEARBY]: "RECOMMENDATION_SURFACE_NEARBY",
  [RecommendationSurface.CHAT]: "RECOMMENDATION_SURFACE_CHAT",
  [RecommendationSurface.TRIP]: "RECOMMENDATION_SURFACE_TRIP",
  [RecommendationSurface.PLACE]: "RECOMMENDATION_SURFACE_PLACE",
};

const channelNames: Partial<Record<RecommendationChannel, RecommendationChannelName>> = {
  [RecommendationChannel.WEB]: "RECOMMENDATION_CHANNEL_WEB",
  [RecommendationChannel.MCP]: "RECOMMENDATION_CHANNEL_MCP",
};

export function fromProtoRecommendationTrace(
  trace?: ProtoRecommendationTrace,
): RecommendationTrace | undefined {
  if (!trace?.runId || !trace.itemId) return undefined;
  const surface = surfaceNames[trace.surface];
  const channel = channelNames[trace.channel];
  if (!surface || !channel) return undefined;
  return {
    runId: trace.runId,
    itemId: trace.itemId,
    rank: trace.rank,
    algorithmVersion: trace.algorithmVersion,
    experimentVariant: trace.experimentVariant,
    surface,
    channel,
  };
}

export function normalizeRecommendationTrace(
  trace?: ProtoRecommendationTrace | RecommendationTrace,
): RecommendationTrace | undefined {
  if (!trace) return undefined;
  if (typeof trace.surface === "string") return trace as RecommendationTrace;
  return fromProtoRecommendationTrace(trace as ProtoRecommendationTrace);
}

export const toProtoRecommendationTrace = (trace?: RecommendationTrace) =>
  trace
    ? create(RecommendationTraceSchema, {
        ...trace,
        surface: surfaces[trace.surface],
        channel: channels[trace.channel],
      })
    : undefined;

const mapSettings = (settings: ProtoPersonalizationSettings): PersonalizationSettings => ({
  personalizationEnabled: settings.personalizationEnabled,
  contributeAggregate: settings.contributeAggregate,
  disclosureSeen: settings.disclosureSeen,
  updatedAt: settings.updatedAt ? timestampDate(settings.updatedAt).toISOString() : "",
});

const mapTasteProfile = (profile: ProtoTasteProfile): TasteProfile => ({
  traits: profile.traits.map((trait) => ({
    key: trait.key,
    label: trait.label,
    score: trait.score,
    confidence: trait.confidence,
    evidenceCount: trait.evidenceCount,
  })),
  feedbackCount: profile.feedbackCount,
  algorithmVersion: profile.algorithmVersion,
  lastFeedbackAt: profile.lastFeedbackAt
    ? timestampDate(profile.lastFeedbackAt).toISOString()
    : undefined,
  updatedAt: profile.updatedAt ? timestampDate(profile.updatedAt).toISOString() : "",
});

export async function recordRecommendationEvents(events: RecommendationEvent[]) {
  if (events.length === 0 || !getAuthToken()) return { accepted: 0, duplicates: 0 };

  return recommendationClient.recordEvents(
    create(RecordEventsRequestSchema, {
      events: events.map((event) =>
        create(RecommendationEventSchema, {
          clientEventId: crypto.randomUUID(),
          eventType: eventTypes[event.eventType],
          occurredAt: timestampFromDate(new Date()),
          trace: toProtoRecommendationTrace(event.trace),
          poiId: event.poiId,
          tripId: event.tripId,
          rating: event.rating,
          metadata: event.metadata ?? {},
        }),
      ),
    }),
  );
}

export const usePersonalizationSettings = () =>
  useAppQuery(() => ({
    queryKey: ["recommendation", "settings"],
    queryFn: async () =>
      mapSettings(
        await recommendationClient.getPersonalizationSettings(
          create(GetPersonalizationSettingsRequestSchema, {}),
        ),
      ),
  }));

export const useTasteProfile = () =>
  useAppQuery(() => ({
    queryKey: ["recommendation", "taste-profile"],
    queryFn: async () =>
      mapTasteProfile(
        await recommendationClient.getTasteProfile(create(GetTasteProfileRequestSchema, {})),
      ),
  }));

export const useUpdatePersonalizationSettings = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (settings: Omit<PersonalizationSettings, "updatedAt">) =>
      mapSettings(
        await recommendationClient.updatePersonalizationSettings(
          create(UpdatePersonalizationSettingsRequestSchema, settings),
        ),
      ),
    onSuccess: (settings) => queryClient.setQueryData(["recommendation", "settings"], settings),
  }));
};

export const useResetTasteProfile = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: () =>
      recommendationClient.resetTasteProfile(
        create(ResetTasteProfileRequestSchema, { confirmation: "RESET" }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recommendation"] }),
  }));
};
