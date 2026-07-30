import { createSignal, For, Show, createMemo } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import {
  Bookmark,
  Plus,
  FolderOpen,
  Loader2,
  Trash2,
  ExternalLink,
  MapPin,
  Calendar,
} from "lucide-solid";
import { A } from "@solidjs/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import {
  ListService,
  GetSavedListsRequestSchema,
  UnsaveListRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/list/list_pb.js";
import { create } from "@bufbuild/protobuf";
import { transport } from "~/lib/connect-transport";
import { authAPI, getAuthToken } from "~/lib/api";
import { useAppQuery } from "~/lib/api/authed-query";

const listClient = createClient(ListService, transport);

// Fetch user's saved/bookmarked lists
const fetchSavedLists = async () => {
  const token = getAuthToken();
  if (!token) return [];

  const session = await authAPI.validateSession();
  if (!session.valid || !session.user_id) return [];

  const response = await listClient.getSavedLists(
    create(GetSavedListsRequestSchema, {
      userId: session.user_id,
      limit: 50,
      offset: 0,
    }),
  );

  return response.lists || [];
};

export default function BookmarksPage() {
  const queryClient = useQueryClient();
  const [_selectedList, _setSelectedList] = createSignal<string | null>(null);

  // Query for saved lists
  const savedListsQuery = useAppQuery(() => ({
    queryKey: ["savedLists"],
    queryFn: fetchSavedLists,
    staleTime: 5 * 60 * 1000,
  }));

  // Unsave mutation
  const unsaveMutation = useMutation(() => ({
    mutationFn: async (listId: string) => {
      const session = await authAPI.validateSession();
      if (!session.valid || !session.user_id) throw new Error("Not authenticated");

      await listClient.unsaveList(
        create(UnsaveListRequestSchema, {
          userId: session.user_id,
          listId: listId,
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedLists"] });
    },
  }));

  const lists = createMemo(() => savedListsQuery.data || []);
  const isLoading = createMemo(() => savedListsQuery.isLoading);
  const isError = createMemo(() => savedListsQuery.isError);

  const handleUnsave = async (listId: string, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    unsaveMutation.mutate(listId);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown date";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Unknown date";
    }
  };

  return (
    <>
      <Title>Bookmarks - Your Saved Itineraries | Loci</Title>
      <Meta
        name="description"
        content="View and manage your bookmarked itineraries and travel plans."
      />

      <div class="min-h-screen relative transition-colors">
        {/* Header */}
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div class="loci-hero">
            <div class="loci-hero__content p-6 sm:p-8 space-y-6">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="relative">
                    <div class="absolute -inset-1 hero-glow blur-md opacity-80" />
                    <div class="loci-hero__icon">
                      <Bookmark class="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">Bookmarks</h1>
                    <p class="loci-hero__subtitle text-sm mt-1">
                      Your saved itineraries and travel plans
                    </p>
                  </div>
                </div>
                <A href="/lists" class="loci-hero__action--strong">
                  <Plus class="w-4 h-4" />
                  Create List
                </A>
              </div>
            </div>
          </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          {/* Loading State */}
          <Show when={isLoading()}>
            <div class="flex items-center justify-center py-16">
              <Loader2 class="w-8 h-8 animate-spin text-primary" />
              <span class="ml-3 text-muted-foreground">Loading your bookmarks...</span>
            </div>
          </Show>

          {/* Error State */}
          <Show when={isError()}>
            <div class="text-center py-16">
              <div class="text-destructive mb-4">Failed to load bookmarks</div>
              <button
                onClick={() => savedListsQuery.refetch()}
                class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Try Again
              </button>
            </div>
          </Show>

          {/* Empty State */}
          <Show when={!isLoading() && !isError() && lists().length === 0}>
            <div class="text-center py-16">
              <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Bookmark class="w-10 h-10 text-primary" />
              </div>
              <h3 class="text-xl font-semibold text-foreground mb-2">No Bookmarks Yet</h3>
              <p class="text-muted-foreground mb-6 max-w-md mx-auto">
                Save itineraries and travel plans to quickly access them later. Click the bookmark
                icon on any itinerary to save it here.
              </p>
              <A
                href="/discover"
                class="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg"
              >
                <FolderOpen class="w-5 h-5" />
                Discover Places
              </A>
            </div>
          </Show>

          {/* Bookmarks Grid */}
          <Show when={!isLoading() && lists().length > 0}>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <For each={lists()}>
                {(list: any) => (
                  <div class="loci-card loci-card-interactive p-5 cursor-pointer group">
                    <div class="flex items-start justify-between mb-4">
                      <div class="flex-1">
                        <h3 class="text-lg font-semibold text-foreground line-clamp-1">
                          {list.name || "Untitled"}
                        </h3>
                        <Show when={list.cityId}>
                          <div class="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <MapPin class="w-3 h-3" />
                            <span>{list.cityId}</span>
                          </div>
                        </Show>
                      </div>
                      <button
                        onClick={(e) => handleUnsave(list.id, e)}
                        disabled={unsaveMutation.isPending}
                        class="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove bookmark"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>

                    <Show when={list.description}>
                      <p class="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {list.description}
                      </p>
                    </Show>

                    <div class="flex items-center justify-between text-xs text-muted-foreground">
                      <div class="flex items-center gap-3">
                        <span class="flex items-center gap-1">
                          <Calendar class="w-3 h-3" />
                          {formatDate(list.createdAt)}
                        </span>
                        <Show when={list.itemCount > 0}>
                          <span>{list.itemCount} items</span>
                        </Show>
                      </div>
                      <A
                        href={`/lists/${list.id}`}
                        class="flex items-center gap-1 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                        <ExternalLink class="w-3 h-3" />
                      </A>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </>
  );
}
