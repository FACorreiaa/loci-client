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
import { useAuthGate } from "../auth/useAuthGate";
import { mapListDetail, type ListDetail } from "../lists/list-detail";
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

// No user id is sent: every ListService RPC acts as the authenticated caller
// and the field is optional (proto v5.28.0). This used to call
// validateSession first just to fill it in.

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
  const gate = useAuthGate();
  return useAppQuery(() => ({
    queryKey: ["lists"],
    enabled: gate(),
    queryFn: async () => {
      const response = await listClient.getLists(
        create(GetListsRequestSchema, { limit: 100, offset: 0 }),
      );
      // Extract the list object from ListWithItems
      return (response.lists || []).map((item: any) => item.list || item);
    },
    staleTime: 5 * 60 * 1000,
  }));
};

/** One list with its items resolved to places (GetList include_detailed_items). */
export const useList = (listId: () => string | undefined) => {
  const gate = useAuthGate();
  return useAppQuery(() => ({
    queryKey: ["list", listId() ?? ""],
    enabled: gate() && !!listId(),
    queryFn: async (): Promise<ListDetail | null> => {
      const response = await listClient.getList(
        create(GetListRequestSchema, { listId: listId()!, includeDetailedItems: true }),
      );
      return response.list ? mapListDetail(response.list) : null;
    },
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
        const response = await listClient.createList(
          create(CreateListRequestSchema, {
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
      const response = await listClient.updateList(
        create(UpdateListRequestSchema, {
          listId,
          name: data.name,
          description: data.description,
          isPublic: data.isPublic,
          // Optional on the wire: unset leaves it alone, so only send it when
          // the form actually carries it. It was never sent before, so the
          // "This is an itinerary" checkbox did nothing on edit.
          isItinerary: data.isItinerary,
          cityId: data.cityId,
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
      await listClient.deleteList(create(DeleteListRequestSchema, { listId }));
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
        const response = await listClient.addListItem(
          create(AddListItemRequestSchema, {
            listId,
            itemId: itemData.itemId,
            contentType: contentTypeToProto(itemData.contentType),
            position: itemData.position || 0,
            notes: itemData.notes || "",
            dayNumber: itemData.dayNumber || 0,
            durationMinutes: itemData.durationMinutes || 0,
            itemAiDescription: (itemData.itemAiDescription || "").slice(0, 4000),
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

export interface RemoveListItemInput {
  listId: string;
  itemId: string;
  contentType?: AddListItemData["contentType"];
}

export const useRemoveFromListMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({ listId, itemId, contentType }: RemoveListItemInput) => {
      await listClient.removeListItem(
        create(RemoveListItemRequestSchema, {
          listId,
          itemId,
          contentType: contentType ? contentTypeToProto(contentType) : ContentType.UNSPECIFIED,
        }),
      );
    },
    onMutate: async ({ listId, itemId }: RemoveListItemInput) => {
      await queryClient.cancelQueries({ queryKey: ["list", listId] });
      const previous = queryClient.getQueryData<ListDetail | null>(["list", listId]);
      if (previous) {
        queryClient.setQueryData<ListDetail>(["list", listId], {
          ...previous,
          items: previous.items.filter((i) => i.itemId !== itemId),
        });
      }
      return { previous };
    },
    onError: (
      _err: unknown,
      { listId }: RemoveListItemInput,
      ctx: { previous?: ListDetail | null } | undefined,
    ) => {
      if (ctx?.previous) queryClient.setQueryData(["list", listId], ctx.previous);
    },
    onSettled: (_: unknown, __: unknown, { listId }: RemoveListItemInput) => {
      queryClient.invalidateQueries({ queryKey: ["list", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  }));
};
