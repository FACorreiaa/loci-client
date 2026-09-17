import { createSignal, For, Show, createMemo } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import {
  Folder,
  Plus,
  Edit3,
  Trash2,
  Lock,
  Globe,
  Loader2,
  X,
  FolderPlus,
  ChevronRight,
  MapPin,
  Calendar,
  Bookmark,
  CheckSquare,
  Square,
} from "lucide-solid";
import {
  useLists,
  useCreateListMutation,
  useUpdateListMutation,
  useDeleteListMutation,
  type CreateListData,
} from "~/lib/api/lists";
import { Button } from "~/ui/button";
import { useSelection, type SelectionItem } from "~/lib/hooks/useSelection";
import { SelectionToolbar } from "~/components/ui/SelectionToolbar";
import { ErrorView } from "~/components/ErrorView";

export default function ListsPage() {
  // State
  const [showModal, setShowModal] = createSignal(false);
  const [editingList, setEditingList] = createSignal<any | null>(null);
  const [formName, setFormName] = createSignal("");
  const [formDescription, setFormDescription] = createSignal("");
  const [formIsPublic, setFormIsPublic] = createSignal(false);
  const [formIsItinerary, setFormIsItinerary] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<"all" | "custom" | "itineraries">("all");
  const [deleteConfirmId, setDeleteConfirmId] = createSignal<string | null>(null);

  // Queries & Mutations
  const listsQuery = useLists();
  const createMutation = useCreateListMutation();
  const updateMutation = useUpdateListMutation();
  const deleteMutation = useDeleteListMutation();

  // Selection state for lists
  const selection = useSelection<SelectionItem>();

  // Convert list to selection item format
  const listToSelectionItem = (list: any): SelectionItem => ({
    id: list.id,
    name: list.name,
    category: list.isItinerary ? "Itinerary" : "List",
    description: list.description || "",
  });

  // Handle list selection toggle
  const handleListSelect = (list: any, e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    selection.toggleSelection(listToSelectionItem(list));
  };

  // Select all filtered lists
  const handleSelectAll = () => {
    const items = filteredLists().map(listToSelectionItem);
    selection.selectAll(items);
  };

  // Derived state
  const lists = createMemo(() => listsQuery.data || []);
  const isLoading = createMemo(() => listsQuery.isLoading);

  // Filter lists by tab
  const filteredLists = createMemo(() => {
    const all = lists();
    switch (activeTab()) {
      case "custom":
        return all.filter((l: any) => !l.isItinerary);
      case "itineraries":
        return all.filter((l: any) => l.isItinerary);
      default:
        return all;
    }
  });

  // Form handlers
  const openCreateModal = () => {
    setEditingList(null);
    setFormName("");
    setFormDescription("");
    setFormIsPublic(false);
    setFormIsItinerary(false);
    setShowModal(true);
  };

  const openEditModal = (list: any) => {
    setEditingList(list);
    setFormName(list.name || "");
    setFormDescription(list.description || "");
    setFormIsPublic(list.isPublic || false);
    setFormIsItinerary(list.isItinerary || false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingList(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!formName().trim()) return;

    const data: CreateListData = {
      name: formName().trim(),
      description: formDescription().trim(),
      isPublic: formIsPublic(),
      isItinerary: formIsItinerary(),
    };

    try {
      if (editingList()) {
        await updateMutation.mutateAsync({
          listId: editingList().id,
          data,
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      closeModal();
    } catch (error) {
      console.error("Failed to save list:", error);
    }
  };

  const handleDelete = async (listId: string) => {
    try {
      await deleteMutation.mutateAsync(listId);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Failed to delete list:", error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <>
      <Title>My Lists - Organize Your Travel | Loci</Title>
      <Meta
        name="description"
        content="Create and manage custom lists of your favorite places, itineraries, and travel plans."
      />

      <div class="min-h-screen relative transition-colors">
        {/* Header */}
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div class="loci-hero">
            <div class="loci-hero__content p-6 sm:p-8 space-y-6">
              <div class="flex items-center justify-between flex-wrap gap-4">
                <div class="flex items-center gap-3">
                  <div class="relative">
                    <div class="absolute -inset-1 hero-glow blur-md opacity-80" />
                    <div class="loci-hero__icon">
                      <Folder class="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">My Lists</h1>
                    <p class="loci-hero__subtitle text-sm mt-1">
                      Organize your saved places and travel plans
                    </p>
                  </div>
                </div>
                <Button onClick={openCreateModal} variant="secondary" class="gap-2">
                  <Plus class="w-5 h-5" />
                  New List
                </Button>
              </div>

              {/* Quick Links */}
              <div class="flex items-center gap-3 flex-wrap">
                <A href="/saved" class="loci-hero__action px-4 py-2">
                  <Bookmark class="w-4 h-4" />
                  View saved
                </A>
              </div>
            </div>
          </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          {/* Tabs */}
          <div class="flex items-center gap-2 mb-6 border-b border-border">
            <button
              onClick={() => setActiveTab("all")}
              class={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab() === "all"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-muted-foreground"
              }`}
            >
              All Lists ({lists().length})
            </button>
            <button
              onClick={() => setActiveTab("custom")}
              class={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab() === "custom"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-muted-foreground"
              }`}
            >
              Custom Lists
            </button>
            <button
              onClick={() => setActiveTab("itineraries")}
              class={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab() === "itineraries"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-muted-foreground"
              }`}
            >
              Itineraries
            </button>
          </div>

          {/* Loading State */}
          <Show when={isLoading()}>
            <div class="flex items-center justify-center py-16">
              <Loader2 class="w-8 h-8 animate-spin text-primary" />
              <span class="ml-3 text-muted-foreground">Loading your lists...</span>
            </div>
          </Show>

          {/* Error State */}
          <Show when={!isLoading() && listsQuery.isError}>
            <ErrorView error={listsQuery.error} onRetry={() => listsQuery.refetch()} class="my-6" />
          </Show>

          {/* Empty State */}
          <Show when={!isLoading() && !listsQuery.isError && filteredLists().length === 0}>
            <div class="text-center py-16">
              <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-accent/10 flex items-center justify-center">
                <FolderPlus class="w-10 h-10 text-accent" />
              </div>
              <h3 class="text-xl font-semibold text-foreground mb-2">
                {activeTab() === "all"
                  ? "No Lists Yet"
                  : `No ${activeTab() === "custom" ? "Custom Lists" : "Itineraries"} Yet`}
              </h3>
              <p class="text-muted-foreground mb-6 max-w-md mx-auto">
                Create your first list to start organizing your favorite places and travel plans.
              </p>
              <Button onClick={openCreateModal} class="gap-2">
                <Plus class="w-5 h-5" />
                Create Your First List
              </Button>
            </div>
          </Show>

          {/* Lists Grid */}
          <Show when={!isLoading() && filteredLists().length > 0}>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <For each={filteredLists()}>
                {(list: any) => (
                  <div class="loci-card-interactive stagger-animation rounded-2xl p-5 group relative">
                    {/* Delete Confirmation Overlay */}
                    <Show when={deleteConfirmId() === list.id}>
                      <div class="absolute inset-0 bg-card/95 backdrop-blur rounded-2xl flex flex-col items-center justify-center z-10 p-4">
                        <p class="text-sm text-foreground mb-4 text-center">
                          Delete "{list.name}"?
                        </p>
                        <div class="flex gap-2">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            class="px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:bg-muted rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(list.id)}
                            disabled={deleteMutation.isPending}
                            class="px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
                          >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </Show>

                    <div class="flex items-start justify-between mb-3">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <h3 class="text-lg font-semibold text-foreground truncate">
                            {list.name}
                          </h3>
                          {list.isPublic ? (
                            <span title="Public">
                              <Globe class="w-4 h-4 text-accent flex-shrink-0" />
                            </span>
                          ) : (
                            <span title="Private">
                              <Lock class="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            </span>
                          )}
                        </div>
                        <Show when={list.isItinerary}>
                          <span class="inline-block px-2 py-0.5 text-xs font-medium bg-accent/20 dark:bg-accent/20 text-accent dark:text-accent rounded-full">
                            Itinerary
                          </span>
                        </Show>
                      </div>

                      {/* Action Buttons */}
                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleListSelect(list, e)}
                          class="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10"
                          title={selection.isSelected(list.id) ? "Deselect" : "Select"}
                        >
                          {selection.isSelected(list.id) ? (
                            <CheckSquare class="w-4 h-4 text-primary" />
                          ) : (
                            <Square class="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(list)}
                          class="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10"
                          title="Edit"
                        >
                          <Edit3 class="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(list.id)}
                          class="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <Show when={list.description}>
                      <p class="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {list.description}
                      </p>
                    </Show>

                    <div class="flex items-center justify-between text-xs text-muted-foreground mb-4">
                      <div class="flex items-center gap-3">
                        <Show when={list.cityId}>
                          <span class="flex items-center gap-1">
                            <MapPin class="w-3 h-3" />
                            {list.cityId}
                          </span>
                        </Show>
                        <span>{list.itemCount || 0} items</span>
                      </div>
                      <Show when={list.createdAt}>
                        <span class="flex items-center gap-1">
                          <Calendar class="w-3 h-3" />
                          {formatDate(list.createdAt)}
                        </span>
                      </Show>
                    </div>

                    <A
                      href={`/lists/${list.id}`}
                      class="flex items-center justify-center gap-2 w-full py-2.5 bg-muted dark:bg-white/5 hover:bg-primary/10 text-foreground hover:text-primary rounded-xl font-medium text-sm transition-colors"
                    >
                      View List
                      <ChevronRight class="w-4 h-4" />
                    </A>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Create/Edit Modal */}
        <Show when={showModal()}>
          <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div class="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 class="text-lg font-semibold text-foreground">
                  {editingList() ? "Edit List" : "Create New List"}
                </h2>
                <button
                  onClick={closeModal}
                  class="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted hover:bg-muted"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} class="p-6 space-y-4">
                <div>
                  <label class="block text-sm font-medium text-foreground mb-1">Name *</label>
                  <input
                    type="text"
                    value={formName()}
                    onInput={(e) => setFormName(e.currentTarget.value)}
                    placeholder="My Travel List"
                    class="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
                    required
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-foreground mb-1">Description</label>
                  <textarea
                    value={formDescription()}
                    onInput={(e) => setFormDescription(e.currentTarget.value)}
                    placeholder="Optional description..."
                    rows={3}
                    class="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-ring resize-none"
                  />
                </div>

                <div class="flex items-center gap-6">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsItinerary()}
                      onChange={(e) => setFormIsItinerary(e.currentTarget.checked)}
                      class="w-4 h-4 rounded border-border text-primary focus:ring-ring"
                    />
                    <span class="text-sm text-foreground">This is an itinerary</span>
                  </label>

                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsPublic()}
                      onChange={(e) => setFormIsPublic(e.currentTarget.checked)}
                      class="w-4 h-4 rounded border-border text-primary focus:ring-ring"
                    />
                    <span class="text-sm text-foreground">Make public</span>
                  </label>
                </div>

                <div class="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={closeModal}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <span class="flex items-center gap-2">
                        <Loader2 class="w-4 h-4 animate-spin" />
                        Saving...
                      </span>
                    ) : editingList() ? (
                      "Save Changes"
                    ) : (
                      "Create List"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Show>

        {/* Selection Toolbar */}
        {/* No Export: list contents are not served yet (GetListItems is
            unimplemented), so a PDF would always have come out empty. */}
        <SelectionToolbar
          count={selection.count()}
          onClear={selection.clearSelection}
          onSelectAll={handleSelectAll}
        />
      </div>
    </>
  );
}
