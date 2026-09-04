// Itineraries queries and mutations - Using RPC
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  ItineraryService,
  GetUserItinerariesRequestSchema,
  GetItineraryRequestSchema,
  UpdateItineraryRequestSchema,
  BookmarkRequestSchema,
  DeleteBookmarkRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/itinerary/itinerary_pb.js";
import { PaginationRequestSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/common/common_pb.js";
import { transport } from "../connect-transport";
import { queryKeys } from "./shared";
import type {
  UserSavedItinerary,
  PaginatedItinerariesResponse,
  BookmarkRequest as BookmarkRequestType,
} from "./types";
import { useAppQuery } from "./authed-query";

const itineraryClient = createClient(ItineraryService, transport);

// Helper to map proto to client type
const mapProtoToItinerary = (proto: any): UserSavedItinerary => ({
  id: proto.id,
  user_id: proto.userId,
  source_llm_interaction_id: proto.sourceLlmInteractionId,
  primary_city_id: proto.primaryCityId,
  title: proto.title,
  description: proto.description || "",
  markdown_content: proto.markdownContent,
  tags: proto.tags || [],
  estimated_duration_days: proto.estimatedDurationDays,
  estimated_cost_level: proto.estimatedCostLevel,
  is_public: proto.isPublic,
  created_at: proto.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  updated_at: proto.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
});

// ====================
// ITINERARY QUERIES (RPC)
// ====================

// Query to get all user's saved itineraries
export const useAllUserItineraries = (options: { enabled?: boolean } = {}) => {
  return useAppQuery(() => ({
    queryKey: queryKeys.userItineraries,
    queryFn: async (): Promise<PaginatedItinerariesResponse> => {
      const request = create(GetUserItinerariesRequestSchema, {
        pagination: create(PaginationRequestSchema, { page: 1, pageSize: 1000 }),
      });
      const response = await itineraryClient.getUserItineraries(request);
      return {
        itineraries: (response.itineraries || []).map(mapProtoToItinerary),
        total: response.pagination?.totalRecords || 0,
        page: response.pagination?.page || 1,
        limit: response.pagination?.pageSize || 1000,
        has_more: (response.pagination?.page || 1) < (response.pagination?.totalPages || 1),
      };
    },
    staleTime: 2 * 60 * 1000,
    enabled: options.enabled ?? true,
  }));
};

// Query to get a single itinerary
export const useItinerary = (itineraryId: string, options: { enabled?: boolean } = {}) => {
  return useAppQuery(() => ({
    queryKey: queryKeys.itinerary(itineraryId),
    queryFn: async (): Promise<UserSavedItinerary> => {
      const request = create(GetItineraryRequestSchema, { itineraryId });
      const response = await itineraryClient.getItinerary(request);
      if (!response.itinerary) {
        throw new Error("Itinerary not found");
      }
      return mapProtoToItinerary(response.itinerary);
    },
    enabled: (options.enabled ?? true) && !!itineraryId,
  }));
};

// Mutation to update an itinerary
export const useUpdateItineraryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({ itineraryId, data }: { itineraryId: string; data: any }) => {
      const request = create(UpdateItineraryRequestSchema, {
        itineraryId,
        title: data.title,
        description: data.description,
        tags: data.tags || [],
        estimatedDurationDays: data.estimated_duration_days,
        estimatedCostLevel: data.estimated_cost_level,
        isPublic: data.is_public,
        markdownContent: data.markdown_content,
      });
      await itineraryClient.updateItinerary(request);
      // Return the updated data for cache update
      return data;
    },
    onSuccess: (_, { itineraryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itinerary(itineraryId) });
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
    },
  }));
};

// ==================
// BOOKMARK MUTATIONS (RPC)
// ==================

// Mutation to save/bookmark an itinerary
export const useSaveItineraryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (itineraryData: BookmarkRequestType) => {
      const request = create(BookmarkRequestSchema, {
        llmInteractionId: itineraryData.llm_interaction_id,
        sessionId: itineraryData.session_id,
        primaryCityId: itineraryData.primary_city_id,
        primaryCityName: itineraryData.primary_city_name || "",
        title: itineraryData.title,
        description: itineraryData.description,
        tags: itineraryData.tags || [],
        isPublic: itineraryData.is_public,
      });
      const response = await itineraryClient.bookmarkItinerary(request);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.userItineraries });
    },
  }));
};

// Mutation to remove/delete a bookmarked itinerary
export const useRemoveItineraryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (itineraryId: string) => {
      const request = create(DeleteBookmarkRequestSchema, { itineraryId });
      const response = await itineraryClient.deleteBookmark(request);
      return response;
    },
    onMutate: async (itineraryId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.userItineraries });
      const previousItineraries = queryClient.getQueryData(queryKeys.userItineraries);

      queryClient.setQueryData(queryKeys.userItineraries, (old: any) => {
        if (!old?.itineraries) return old;
        return {
          ...old,
          itineraries: old.itineraries.filter((itinerary: any) => itinerary.id !== itineraryId),
        };
      });

      return { previousItineraries };
    },
    onError: (err, itineraryId, context) => {
      if (context?.previousItineraries) {
        queryClient.setQueryData(queryKeys.userItineraries, context.previousItineraries);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.userItineraries });
    },
  }));
};
