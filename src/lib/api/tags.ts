// Tags queries and mutations - RPC version
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { TagsService } from "@buf/loci_loci-proto.bufbuild_es/loci/tags/tags_pb.js";
import {
  GetTagsRequestSchema,
  CreateTagRequestSchema,
  UpdateTagRequestSchema,
  DeleteTagRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/tags/tags_pb.js";
import { queryKeys } from "./shared";
import { transport } from "../connect-transport";
import type { PersonalTag } from "./types";
import { useAppQuery } from "./authed-query";

// Create the tags service client
const tagsClient = createClient(TagsService, transport);

// ===============
// TAGS QUERIES
// ===============

export const useTags = () => {
  return useAppQuery(() => ({
    queryKey: queryKeys.tags,
    queryFn: async (): Promise<PersonalTag[]> => {
      const request = create(GetTagsRequestSchema, {});
      const response = await tagsClient.getTags(request);

      return response.tags.map(
        (tag): PersonalTag => ({
          id: tag.id,
          name: tag.name,
          tag_type: tag.tagType,
          description: tag.description ?? null,
          source: (tag.source === "global" ? "global" : "personal") as "global" | "personal" | null,
          active: tag.active ?? true,
          created_at: tag.createdAt
            ? new Date(Number(tag.createdAt.seconds) * 1000).toISOString()
            : "",
          updated_at: tag.updatedAt
            ? new Date(Number(tag.updatedAt.seconds) * 1000).toISOString()
            : null,
        }),
      );
    },
    staleTime: 15 * 60 * 1000,
  }));
};

export const useCreateTagMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({
      name,
      description,
      tag_type,
      active = true,
    }: {
      name: string;
      description: string;
      tag_type: string;
      active?: boolean;
    }) => {
      const request = create(CreateTagRequestSchema, {
        name,
        description,
        tagType: tag_type,
        active,
      });

      const response = await tagsClient.createTag(request);
      return response.tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  }));
};

export const useUpdateTagMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({
      id,
      name,
      description,
      tag_type,
      active,
    }: {
      id: string;
      name?: string;
      description?: string;
      tag_type?: string;
      active?: boolean;
    }) => {
      const request = create(UpdateTagRequestSchema, {
        tagId: id,
        name: name ?? "",
        description: description ?? "",
        tagType: tag_type ?? "",
        active: active ?? true,
      });

      const response = await tagsClient.updateTag(request);
      return { success: response.success };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  }));
};

export const useToggleTagActiveMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const request = create(UpdateTagRequestSchema, {
        tagId: id,
        name: "",
        description: "",
        tagType: "",
        active,
      });

      const response = await tagsClient.updateTag(request);
      return { success: response.success };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  }));
};

export const useDeleteTagMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (tagId: string) => {
      const request = create(DeleteTagRequestSchema, { tagId });
      const response = await tagsClient.deleteTag(request);
      return { success: response.success };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  }));
};
