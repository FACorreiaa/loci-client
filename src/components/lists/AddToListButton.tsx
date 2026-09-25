import { createSignal, Show, For } from "solid-js";
import { Portal } from "solid-js/web";
import { A } from "@solidjs/router";
import { Plus, FolderPlus, X, Check } from "lucide-solid";
import { useLists, useCreateListMutation, useAddToListMutation } from "~/lib/api/lists";
import type { RecommendationTrace } from "~/lib/api/recommendations";
import { useAuth } from "~/contexts/AuthContext";
import { friendlyError } from "~/lib/connect-errors";

interface AddToListButtonProps {
  itemId: string;
  contentType: "poi" | "restaurant" | "hotel" | "itinerary";
  itemName: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "button" | "minimal";
  sourceInteractionId?: string;
  aiDescription?: string;
  recommendationTrace?: RecommendationTrace;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Add to list" for one place.
 *
 * AddListItem keys on the place's UUID, so a place that only exists in a
 * streamed answer (no catalogue id yet) renders nothing rather than a button
 * that can only fail.
 */
export default function AddToListButton(props: AddToListButtonProps) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = createSignal(false);
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [newListName, setNewListName] = createSignal("");
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [addedTo, setAddedTo] = createSignal<string | null>(null);

  const listsQuery = useLists();
  const createListMutation = useCreateListMutation();
  const addToListMutation = useAddToListMutation();

  const lists = () => listsQuery.data || [];

  const iconSize = () =>
    props.size === "sm" ? "w-4 h-4" : props.size === "lg" ? "w-6 h-6" : "w-5 h-5";
  const boxSize = () =>
    props.size === "sm" ? "h-8 w-8" : props.size === "lg" ? "h-12 w-12" : "h-10 w-10";

  const openModal = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setAddedTo(null);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setShowCreateForm(false);
    setNewListName("");
  };

  const addToList = async (listId: string, listName: string) => {
    setError(null);
    try {
      await addToListMutation.mutateAsync({
        listId,
        itemData: {
          itemId: props.itemId,
          contentType: props.contentType,
          notes: "",
          itemAiDescription: props.aiDescription,
          recommendationTrace: props.recommendationTrace,
        },
      });
      setAddedTo(listName);
      close();
    } catch (err) {
      setError(`Couldn't add it to ${listName}. ${friendlyError(err).message}`);
    }
  };

  const createNewList = async () => {
    const name = newListName().trim();
    if (!name) return;
    setIsCreating(true);
    setError(null);
    try {
      // No city and no description: both are optional now, and a description
      // like "List created for X" was noise the owner then had to delete.
      const newList = await createListMutation.mutateAsync({ name, isPublic: false });
      if (newList?.id) await addToList(newList.id, newList.name || name);
    } catch (err) {
      setError(`Couldn't create the list. ${friendlyError(err).message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const trigger = () => {
    const label = `Add ${props.itemName} to a list`;
    if (props.variant === "button") {
      return (
        <button
          type="button"
          onClick={openModal}
          class={`inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted ${props.className || ""}`}
        >
          <FolderPlus class="h-4 w-4" />
          Add to list
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={openModal}
        aria-label={label}
        title={label}
        class={`inline-flex ${boxSize()} items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary ${props.variant === "icon" ? "border border-border bg-background" : ""} ${props.className || ""}`}
      >
        <Show when={addedTo()} fallback={<FolderPlus class={iconSize()} />}>
          <Check class={`${iconSize()} text-primary`} />
        </Show>
      </button>
    );
  };

  return (
    <Show when={UUID.test(props.itemId)}>
      {trigger()}

      {/* Portalled: the trigger sits inside cards that are themselves buttons
          (StopCard handles Enter/Space), and keys typed into this dialog must
          not bubble up to them. */}
      <Show when={open()}>
        <Portal>
          <div
            class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-to-list-title"
              class="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl"
            >
              <div class="flex items-center justify-between border-b border-border p-5">
                <div class="min-w-0">
                  <h3 id="add-to-list-title" class="text-lg font-semibold">
                    Add to list
                  </h3>
                  <p class="mt-0.5 truncate text-sm text-muted-foreground">{props.itemName}</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  class="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  aria-label="Close"
                >
                  <X class="h-5 w-5" />
                </button>
              </div>

              <div class="max-h-80 overflow-y-auto p-5">
                <Show
                  when={isAuthenticated()}
                  fallback={
                    <p class="text-sm text-muted-foreground">
                      <A href="/auth/signin" class="font-medium text-primary underline">
                        Sign in
                      </A>{" "}
                      to keep places in lists.
                    </p>
                  }
                >
                  <Show
                    when={!showCreateForm()}
                    fallback={
                      <form
                        class="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void createNewList();
                        }}
                      >
                        <label class="block text-sm font-medium">
                          New list name
                          <input
                            type="text"
                            value={newListName()}
                            onInput={(e) => setNewListName(e.currentTarget.value)}
                            placeholder="Coffee in Lisbon"
                            maxlength={200}
                            class="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </label>
                        <div class="flex gap-2">
                          <button
                            type="submit"
                            disabled={!newListName().trim() || isCreating()}
                            class="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                          >
                            {isCreating() ? "Creating…" : "Create and add"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateForm(false);
                              setNewListName("");
                            }}
                            class="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    }
                  >
                    <div class="space-y-2">
                      <Show when={listsQuery.isLoading}>
                        <div class="h-16 animate-pulse rounded-lg bg-muted" />
                      </Show>
                      <Show when={listsQuery.isError}>
                        <p class="text-sm text-destructive">Your lists didn&apos;t load.</p>
                      </Show>
                      <Show when={listsQuery.isSuccess && lists().length === 0}>
                        <p class="py-2 text-sm text-muted-foreground">No lists yet.</p>
                      </Show>
                      <For each={lists()}>
                        {(list: any) => (
                          <button
                            type="button"
                            onClick={() => void addToList(list.id, list.name)}
                            disabled={addToListMutation.isPending}
                            class="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                          >
                            <span class="block truncate font-medium">{list.name}</span>
                            <span class="block truncate text-xs text-muted-foreground">
                              {list.itemCount || 0} {list.itemCount === 1 ? "item" : "items"}
                              {list.isItinerary ? " · Itinerary" : ""}
                            </span>
                          </button>
                        )}
                      </For>
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(true)}
                        class="flex w-full items-center gap-2 rounded-lg border-2 border-dashed border-border p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <Plus class="h-4 w-4" />
                        New list
                      </button>
                    </div>
                  </Show>
                </Show>

                <Show when={error()}>
                  <p class="mt-3 text-sm text-destructive" role="alert">
                    {error()}
                  </p>
                </Show>
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </Show>
  );
}
