// Places from a shared link: PlaceIntelligenceService.ImportPlaces reads it,
// and the picked places go into a list through ListService.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  ImportPlacesRequestSchema,
  PlaceIntelligenceService,
} from "@buf/loci_loci-proto.bufbuild_es/loci/place/place_intelligence_pb.js";
import {
  AddListItemRequestSchema,
  ContentType,
  CreateListRequestSchema,
  ListService,
} from "@buf/loci_loci-proto.bufbuild_es/loci/list/list_pb.js";
import { transport } from "../connect-transport";
import { capture } from "../analytics";
import {
  saveImported,
  toImportView,
  type ImportedPlaceView,
  type SaveTarget,
} from "../import/link-import";

const placeClient = createClient(PlaceIntelligenceService, transport);
const listClient = createClient(ListService, transport);

export const useImportPlaces = () =>
  useMutation(() => ({
    mutationFn: async (input: { url: string; cityHint?: string }) => {
      const res = await placeClient.importPlaces(
        create(ImportPlacesRequestSchema, {
          url: input.url.trim(),
          cityHint: input.cityHint?.trim() || undefined,
        }),
      );
      return toImportView(res);
    },
    onSuccess: (view) =>
      capture("link_imported", {
        source: view.source,
        places: view.places.length,
        resolved: view.places.filter((p) => p.poiId).length,
      }),
  }));

export const useSaveImported = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: ({ target, places }: { target: SaveTarget; places: ImportedPlaceView[] }) =>
      saveImported(
        {
          createList: async (name) => {
            const res = await listClient.createList(
              create(CreateListRequestSchema, { name, description: "Imported from a link" }),
            );
            if (!res.list?.id) throw new Error("No list was created.");
            return res.list.id;
          },
          addItem: async (listId, poiId) => {
            await listClient.addListItem(
              create(AddListItemRequestSchema, {
                listId,
                itemId: poiId,
                contentType: ContentType.POI,
              }),
            );
          },
        },
        target,
        places,
      ),
    onSuccess: (out) => {
      if (out.added > 0) capture("poi_saved", { surface: "link_import", count: out.added });
    },
    onSettled: (out) => {
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      if (out) void queryClient.invalidateQueries({ queryKey: ["list", out.listId] });
    },
  }));
};
