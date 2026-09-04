// Lists queries and mutations using ConnectRPC ListService
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import {
  ListService,
  GetListsRequestSchema,
  GetListRequestSchema,
  CreateListRequestSchema,
  UpdateListRequestSchema,
  DeleteListRequestSchema,
  AddListItemRequestSchema,
  RemoveListItemRequestSchema,
  ContentType,
} from "@buf/loci_loci-proto.bufbuild_es/loci/list/list_pb.js";
import { create } from "@bufbuild/protobuf";
import { transport } from "../connect-transport";
import { getAuthToken, authAPI } from "../api";
import { handleEntitlementError } from "../entitlement-error";
import {
  recordRecommendationEvents,
  toProtoRecommendationTrace,
  type RecommendationTrace,
} from "./recommendations";
import { useAppQuery } from "./authed-query";
import { capture } from "../analytics";

const listClient = createClient(ListService, transport);

async function withEntitlementGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    handleEntitlementError(err);
    throw err;
  }
}

// Cache for user ID
let cachedUserId: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getUserId = async (): Promise<string | null> => {
  const now = Date.now();
  if (cachedUserId && now - cacheTimestamp < CACHE_TTL) {
    return cachedUserId;
  }

  const token = getAuthToken();
  if (!token) return null;

  try {
    const session = await authAPI.validateSession();
    if (session.valid && session.user_id) {
      cachedUserId = session.user_id;
      cacheTimestamp = now;
      return cachedUserId;
    }
  } catch (e) {
    console.warn("Failed to get user ID:", e);
  }
  return null;
};

// Helper to map content type string to proto enum
export const contentTypeToProto = (type: string): ContentType => {
  switch (type.toLowerCase()) {
    case "poi":
      return ContentType.POI;
    case "restaurant":
      return ContentType.RESTAURANT;
    case "hotel":
      return ContentType.HOTEL;
    case "itinerary":
      return ContentType.ITINERARY;
    default:
      return ContentType.UNSPECIFIED;
  }
};

// ===============
// LISTS QUERIES (RPC)
// ===============

export const useLists = () => {
  return useAppQuery(() => ({
    queryKey: ["lists"],
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) return [];

      const response = await listClient.getLists(
        create(GetListsRequestSchema, {
          userId,
          limit: 100,
          offset: 0,
        }),
      );
      // Extract the list object from ListWithItems
      return (response.lists || []).map((item: any) => item.list || item);
    },
    staleTime: 5 * 60 * 1000,
  }));
};

export const useList = (listId: string) => {
  return useAppQuery(() => ({
    queryKey: ["list", listId],
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) return null;

      const response = await listClient.getList(
        create(GetListRequestSchema, {
          userId,
          listId,
          includeDetailedItems: true,
        }),
      );
      return response.list;
    },
    enabled: !!listId,
  }));
};

// ===============
// LISTS MUTATIONS (RPC)
// ===============

export interface CreateListData {
  name: string;
  description?: string;
  cityId?: string;
  isItinerary?: boolean;
  isPublic?: boolean;
}

export const useCreateListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (data: CreateListData) =>
      withEntitlementGuard(async () => {
        const userId = await getUserId();
        if (!userId) throw new Error("Not authenticated");

        const response = await listClient.createList(
          create(CreateListRequestSchema, {
            userId,
            name: data.name,
            description: data.description || "",
            cityId: data.cityId || "",
            isItinerary: data.isItinerary || false,
            isPublic: data.isPublic || false,
          }),
        );
        return response.list;
      }),
    onSuccess: (newList: any) => {
      if (newList) {
        queryClient.setQueryData(["lists"], (old: any[] = []) => [...old, newList]);
      }
    },
  }));
};

export const useUpdateListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({ listId, data }: { listId: string; data: Partial<CreateListData> }) => {
      const userId = await getUserId();
      if (!userId) throw new Error("Not authenticated");

      const response = await listClient.updateList(
        create(UpdateListRequestSchema, {
          userId,
          listId,
          name: data.name,
          description: data.description,
          isPublic: data.isPublic,
        }),
      );
      return { list: response.list, listId };
    },
    onSuccess: (result: { list: any; listId: string }) => {
      if (result.list) {
        queryClient.setQueryData(["list", result.listId], result.list);
        queryClient.setQueryData(["lists"], (old: any[] = []) =>
          old.map((list) => (list.id === result.listId ? result.list : list)),
        );
      }
    },
  }));
};

export const useDeleteListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (listId: string) => {
      const userId = await getUserId();
      if (!userId) throw new Error("Not authenticated");

      await listClient.deleteList(
        create(DeleteListRequestSchema, {
          userId,
          listId,
        }),
      );
    },
    onMutate: async (listId: string) => {
      await queryClient.cancelQueries({ queryKey: ["lists"] });
      const previousLists = queryClient.getQueryData(["lists"]);

      queryClient.setQueryData(["lists"], (old: any[] = []) =>
        old.filter((list) => list.id !== listId),
      );

      return { previousLists };
    },
    onError: (_err: unknown, _listId: string, context: any) => {
      if (context?.previousLists) {
        queryClient.setQueryData(["lists"], context.previousLists);
      }
    },
    onSettled: (_: unknown, __: unknown, listId: string) => {
      queryClient.removeQueries({ queryKey: ["list", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  }));
};

// ===============
// LIST ITEMS MUTATIONS (RPC)
// ===============

export interface AddListItemData {
  itemId: string;
  contentType: "poi" | "restaurant" | "hotel" | "itinerary";
  position?: number;
  notes?: string;
  dayNumber?: number;
  durationMinutes?: number;
  itemAiDescription?: string;
  recommendationTrace?: RecommendationTrace;
}

export const useAddToListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({ listId, itemData }: { listId: string; itemData: AddListItemData }) =>
      withEntitlementGuard(async () => {
        const userId = await getUserId();
        if (!userId) throw new Error("Not authenticated");

        const response = await listClient.addListItem(
          create(AddListItemRequestSchema, {
            userId,
            listId,
            itemId: itemData.itemId,
            contentType: contentTypeToProto(itemData.contentType),
            position: itemData.position || 0,
            notes: itemData.notes || "",
            dayNumber: itemData.dayNumber || 0,
            durationMinutes: itemData.durationMinutes || 0,
            recommendationTrace: toProtoRecommendationTrace(itemData.recommendationTrace),
          }),
        );
        return response;
      }),
    onSuccess: (_, { listId, itemData }) => {
      capture("poi_saved", { surface: "list", content_type: itemData.contentType });
      queryClient.invalidateQueries({ queryKey: ["list", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      if (itemData.recommendationTrace) {
        void recordRecommendationEvents([
          {
            eventType: "RECOMMENDATION_EVENT_TYPE_ADDED_TO_LIST",
            trace: itemData.recommendationTrace,
            poiId: itemData.itemId,
            metadata: { list_id: listId },
          },
        ]);
      }
    },
  }));
};

export const useRemoveFromListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({ listId, itemId }: { listId: string; itemId: string }) => {
      const userId = await getUserId();
      if (!userId) throw new Error("Not authenticated");

      await listClient.removeListItem(
        create(RemoveListItemRequestSchema, {
          userId,
          listId,
          itemId,
        }),
      );
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ["list", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  }));
};
