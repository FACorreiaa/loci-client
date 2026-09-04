import { createSignal, For, Show } from "solid-js";
import { Plus, X, Save, Heart } from "lucide-solid";
import { Switch } from "@/ui/switch";
import type { Interest } from "~/lib/api/types";

interface InterestsUIProps {
  interests: Interest[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onCreateInterest: (data: {
    name: string;
    description: string;
    active?: boolean;
  }) => Promise<void>;
  onUpdateInterest: (data: { id: string; name: string; description: string }) => Promise<void>;
  onDeleteInterest: (interest: Interest) => Promise<void>;
  onToggleActive: (interest: Interest) => Promise<void>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isToggling: boolean;
}

export default function InterestsComponent(props: InterestsUIProps) {
  // Form state
  const [newInterest, setNewInterest] = createSignal("");
  const [newInterestDescription, setNewInterestDescription] = createSignal("");
  const [showAddInterestForm, setShowAddInterestForm] = createSignal(false);
  const [newInterestError, setNewInterestError] = createSignal("");

  // Edit state
  const [editingInterest, setEditingInterest] = createSignal<Interest | null>(null);
  const [editInterestName, setEditInterestName] = createSignal("");
  const [editInterestDescription, setEditInterestDescription] = createSignal("");
  const [editInterestError, setEditInterestError] = createSignal("");

  // Mobile UX: Track which interest is actively selected for actions
  const [activeInterestForActions, setActiveInterestForActions] = createSignal<string | null>(null);

  // Get active interests
  const activeInterests = () => props.interests.filter((interest) => interest.active ?? false);
  const customInterests = () => props.interests.filter((interest) => interest.source === "custom");
  const globalInterests = () => props.interests.filter((interest) => interest.source === "global");

  // Create interest
  const handleCreateInterest = async () => {
    const name = newInterest().trim();
    const description = newInterestDescription().trim();

    // Validate on submit
    if (!name) {
      setNewInterestError("Interest name is required");
      return;
    }
    if (name.length < 2) {
      setNewInterestError("Interest name must be at least 2 characters");
      return;
    }
    setNewInterestError("");

    try {
      await props.onCreateInterest({
        name,
        description,
        active: true,
      });
      setNewInterest("");
      setNewInterestDescription("");
      setShowAddInterestForm(false);
    } catch (error) {
      console.error("Failed to create interest:", error);
      setNewInterestError("Failed to create interest. Please try again.");
    }
  };

  // Start editing
  const startEditingInterest = (interest: Interest) => {
    setEditingInterest(interest);
    setEditInterestName(interest.name);
    setEditInterestDescription(interest.description || "");
  };

  // Save edited interest
  const saveEditedInterest = async () => {
    const interest = editingInterest();
    const name = editInterestName().trim();
    const description = editInterestDescription().trim();

    // Validate on submit
    if (!name) {
      setEditInterestError("Interest name is required");
      return;
    }
    if (name.length < 2) {
      setEditInterestError("Interest name must be at least 2 characters");
      return;
    }
    setEditInterestError("");

    if (interest) {
      try {
        await props.onUpdateInterest({
          id: interest.id,
          name,
          description,
        });
        setEditingInterest(null);
        setEditInterestName("");
        setEditInterestDescription("");
        setEditInterestError("");
      } catch (error) {
        console.error("Failed to update interest:", error);
        setEditInterestError("Failed to update interest. Please try again.");
      }
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingInterest(null);
    setEditInterestName("");
    setEditInterestDescription("");
  };

  // Rendered through Show rather than an early return: a component body runs
  // once in Solid, so returning early on props.isLoading would freeze this
  // panel on its spinner the moment the request settled.
  const loadingView = () => (
    <div class="space-y-8">
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    </div>
  );

  const errorView = () => (
    <div class="space-y-8">
      <div class="text-center py-12">
        <h3 class="text-lg font-semibold text-foreground mb-2">Error Loading Interests</h3>
        <p class="text-muted-foreground mb-4">Unable to load interests. Please try again.</p>
        <button
          onClick={props.onRetry}
          class="px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg"
        >
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <Show when={!props.isLoading} fallback={loadingView()}>
      <Show when={!props.isError} fallback={errorView()}>
        <div class="space-y-8">
          <div>
            <h2 class="text-2xl font-bold text-foreground mb-2">Travel Interests</h2>
            <p class="text-muted-foreground">
              Spotlight what you love so the AI leans into it. Mix platform interests with your own.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-2xl loci-card shadow-sm p-4">
              <p class="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
              <div class="text-2xl font-bold text-foreground">{activeInterests().length}</div>
              <p class="text-xs text-muted-foreground">Driving recommendations</p>
            </div>
            <div class="rounded-2xl loci-card shadow-sm p-4">
              <p class="text-xs uppercase tracking-wide text-muted-foreground">Custom</p>
              <div class="text-2xl font-bold text-foreground">{customInterests().length}</div>
              <p class="text-xs text-muted-foreground">Your personal angles</p>
            </div>
            <div class="rounded-2xl loci-card shadow-sm p-4">
              <p class="text-xs uppercase tracking-wide text-muted-foreground">Global</p>
              <div class="text-2xl font-bold text-foreground">{globalInterests().length}</div>
              <p class="text-xs text-muted-foreground">Ready-made options</p>
            </div>
          </div>

          <div class="loci-card p-6">
            {/* Add New Interest Form */}
            <div class="mb-6 pb-6 border-b border-border">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h4 class="font-semibold text-foreground">Manage Interests</h4>
                  <p class="text-sm text-muted-foreground">
                    Short, precise interests work best for recommendations.
                  </p>
                </div>
                <Show
                  when={!showAddInterestForm()}
                  fallback={
                    <button
                      onClick={() => {
                        setShowAddInterestForm(false);
                        setNewInterest("");
                        setNewInterestDescription("");
                        setNewInterestError("");
                      }}
                      class="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg border border-border"
                    >
                      Cancel
                    </button>
                  }
                >
                  <button
                    onClick={() => setShowAddInterestForm(true)}
                    class="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-sm font-semibold shadow-md"
                  >
                    <Plus class="w-4 h-4" />
                    Add New Interest
                  </button>
                </Show>
              </div>

              <Show when={showAddInterestForm()}>
                <div class="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="space-y-1">
                      <input
                        type="text"
                        value={newInterest()}
                        onInput={(e) => {
                          setNewInterest(e.target.value);
                          if (newInterestError()) setNewInterestError("");
                        }}
                        placeholder="Interest name..."
                        class={`w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:border-transparent text-sm bg-background text-foreground transition-colors ${
                          newInterestError()
                            ? "border-destructive focus:ring-destructive"
                            : "border-border focus:ring-ring"
                        }`}
                      />
                      <Show when={newInterestError()}>
                        <p class="text-sm text-destructive">{newInterestError()}</p>
                      </Show>
                    </div>
                    <button
                      onClick={handleCreateInterest}
                      disabled={props.isCreating}
                      class="px-4 py-2.5 bg-primary hover:opacity-90 text-primary-foreground rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold shadow-sm"
                    >
                      {props.isCreating ? "Adding..." : "Add"}
                    </button>
                  </div>
                  <textarea
                    value={newInterestDescription()}
                    onInput={(e) => setNewInterestDescription(e.target.value)}
                    placeholder="Interest description (optional)..."
                    rows={2}
                    class="w-full px-3 py-2.5 border border-border rounded-xl focus:ring-2 focus:ring-ring focus:border-transparent text-sm bg-background text-foreground"
                  />
                </div>
              </Show>
            </div>

            {/* Interests Grid */}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <For each={props.interests}>
                {(interest) => (
                  <Show
                    when={editingInterest()?.id === interest.id}
                    fallback={
                      <div class="group relative interest-action-container overflow-hidden loci-card hover:shadow-md transition-all duration-200">
                        <div class="absolute inset-x-0 top-0 h-1 bg-primary" />
                        <div
                          onClick={() => {
                            if (interest.source === "custom" && window.innerWidth < 640) {
                              setActiveInterestForActions(
                                activeInterestForActions() === interest.id ? null : interest.id,
                              );
                            }
                          }}
                          class={`p-4 space-y-3 ${activeInterestForActions() === interest.id ? "ring-2 ring-primary/30" : ""}`}
                        >
                          <div class="flex items-start justify-between mb-2 gap-3">
                            <div class="space-y-1">
                              <div class="flex items-center gap-2">
                                <h4 class="font-semibold text-foreground">{interest.name}</h4>
                                <Switch
                                  checked={interest.active ?? false}
                                  onChange={() => props.onToggleActive(interest)}
                                  disabled={props.isToggling}
                                />
                              </div>
                              <Show when={interest.description}>
                                <p class="text-sm text-muted-foreground line-clamp-2">
                                  {interest.description || "No description"}
                                </p>
                              </Show>
                            </div>
                            <div class="flex flex-col items-end gap-2">
                              <Show when={interest.source === "global"}>
                                <span class="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold border border-primary/20">
                                  Global
                                </span>
                              </Show>
                              <span
                                class={`px-2 py-1 rounded-full text-xs font-semibold border ${
                                  (interest.active ?? false)
                                    ? "bg-accent/10 text-accent border-accent/20"
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {(interest.active ?? false) ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions for custom interests only */}
                        <Show when={interest.source === "custom"}>
                          <div class="hidden sm:flex items-center justify-end gap-2 px-4 pb-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingInterest(interest);
                              }}
                              class="px-3 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 text-xs font-semibold border border-border"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                props.onDeleteInterest(interest);
                              }}
                              class="px-3 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-semibold border border-destructive/20"
                            >
                              Delete
                            </button>
                          </div>

                          {/* Mobile: Show action buttons below when active */}
                          <Show when={activeInterestForActions() === interest.id}>
                            <div class="sm:hidden px-3 pb-3 space-y-2">
                              <div class="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    props.onToggleActive(interest);
                                    setActiveInterestForActions(null);
                                  }}
                                  disabled={props.isToggling}
                                  class={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                                    (interest.active ?? false)
                                      ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                      : "bg-primary/10 text-primary hover:bg-primary/20"
                                  } ${props.isToggling ? "opacity-50" : ""}`}
                                >
                                  {(interest.active ?? false) ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditingInterest(interest);
                                    setActiveInterestForActions(null);
                                  }}
                                  class="flex-1 px-3 py-2 bg-muted text-foreground rounded text-sm font-medium hover:bg-muted/80"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    props.onDeleteInterest(interest);
                                    setActiveInterestForActions(null);
                                  }}
                                  class="flex-1 px-3 py-2 bg-destructive/10 text-destructive rounded text-sm font-medium hover:bg-destructive/20"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </Show>
                        </Show>
                      </div>
                    }
                  >
                    {/* Edit Form */}
                    <div class="p-4 bg-muted rounded-2xl border-2 border-border shadow-inner">
                      <div class="space-y-3">
                        <div class="space-y-1">
                          <input
                            type="text"
                            value={editInterestName()}
                            onInput={(e) => {
                              setEditInterestName(e.target.value);
                              if (editInterestError()) setEditInterestError("");
                            }}
                            placeholder="Interest name..."
                            class={`w-full px-3 py-2.5 border rounded-xl text-sm bg-background text-foreground transition-colors ${
                              editInterestError()
                                ? "border-destructive focus:ring-destructive"
                                : "border-border"
                            }`}
                          />
                          <Show when={editInterestError()}>
                            <p class="text-sm text-destructive">{editInterestError()}</p>
                          </Show>
                        </div>
                        <textarea
                          value={editInterestDescription()}
                          onInput={(e) => setEditInterestDescription(e.target.value)}
                          placeholder="Interest description..."
                          rows={2}
                          class="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground"
                        />
                        <div class="flex gap-2">
                          <button
                            onClick={saveEditedInterest}
                            disabled={props.isUpdating}
                            class="px-3 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-sm font-semibold flex items-center gap-1 disabled:opacity-50"
                          >
                            <Save class="w-3 h-3" />
                            {props.isUpdating ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEditing}
                            class="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-sm font-semibold flex items-center gap-1"
                          >
                            <X class="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </Show>
                )}
              </For>
            </div>

            <Show when={props.interests.length === 0}>
              <div class="text-center py-10">
                <p class="text-muted-foreground">
                  No interests found. Create your first interest above!
                </p>
              </div>
            </Show>

            {/* Active Interests Summary */}
            <Show when={props.interests.length > 0}>
              <div class="mt-8 pt-6 border-t border-border">
                <h4 class="font-semibold text-foreground mb-4">
                  Active Interests ({activeInterests().length})
                </h4>
                <Show when={activeInterests().length === 0}>
                  <p class="text-muted-foreground text-sm">
                    No active interests. Activate some interests above to see them here.
                  </p>
                </Show>
                <Show when={activeInterests().length > 0}>
                  <div class="flex flex-wrap gap-2">
                    <For each={activeInterests()}>
                      {(interest) => (
                        <span
                          class={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                            interest.source === "global"
                              ? "bg-primary/10 text-primary"
                              : "bg-accent/10 text-accent"
                          }`}
                        >
                          <Heart class="w-3 h-3 fill-current" />
                          {interest.name}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </Show>
  );
}
