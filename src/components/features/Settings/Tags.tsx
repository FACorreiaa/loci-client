import { createSignal, For, Show } from "solid-js";
import { Plus, X, Save } from "lucide-solid";
import { Switch } from "@/ui/switch";
import type { PersonalTag } from "~/lib/api/types";

interface TagsUIProps {
  tags: PersonalTag[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onCreateTag: (data: { name: string; description: string; tag_type: string }) => Promise<void>;
  onUpdateTag: (data: {
    id: string;
    name: string;
    description: string;
    tag_type: string;
  }) => Promise<void>;
  onDeleteTag: (tag: PersonalTag) => Promise<void>;
  onToggleActive: (tag: PersonalTag) => Promise<void>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isToggling: boolean;
}

export default function TagsComponent(props: TagsUIProps) {
  // Form state
  const [newTagName, setNewTagName] = createSignal("");
  const [newTagDescription, setNewTagDescription] = createSignal("");
  const [newTagType, setNewTagType] = createSignal("");
  const [showAddTagForm, setShowAddTagForm] = createSignal(false);
  const [newTagErrors, setNewTagErrors] = createSignal<{
    name?: string;
    type?: string;
    description?: string;
  }>({});

  // Edit state
  const [editingTag, setEditingTag] = createSignal<PersonalTag | null>(null);
  const [editTagName, setEditTagName] = createSignal("");
  const [editTagDescription, setEditTagDescription] = createSignal("");
  const [editTagType, setEditTagType] = createSignal("");
  const [_editTagErrors, setEditTagErrors] = createSignal<{
    name?: string;
    type?: string;
    description?: string;
  }>({});

  // Mobile UX: Track which tag is actively selected for actions
  const [activeTagForActions, setActiveTagForActions] = createSignal<string | null>(null);
  const activeTags = () => props.tags.filter((tag) => tag.active ?? false);
  const personalTags = () => props.tags.filter((tag) => tag.source === "personal");
  const globalTags = () => props.tags.filter((tag) => tag.source === "global");

  // Create tag
  const handleCreateTag = async () => {
    const name = newTagName().trim();
    const description = newTagDescription().trim();
    const tag_type = newTagType().trim();

    // Validate on submit
    const errors: { name?: string; type?: string; description?: string } = {};
    if (!name) errors.name = "Tag name is required";
    else if (name.length < 2) errors.name = "Tag name must be at least 2 characters";
    if (!tag_type) errors.type = "Tag type is required";
    if (!description) errors.description = "Description is required";

    if (Object.keys(errors).length > 0) {
      setNewTagErrors(errors);
      return;
    }
    setNewTagErrors({});

    try {
      await props.onCreateTag({ name, description, tag_type });
      setNewTagName("");
      setNewTagDescription("");
      setNewTagType("");
      setShowAddTagForm(false);
    } catch (error) {
      console.error("Failed to create tag:", error);
      setNewTagErrors({ name: "Failed to create tag. Please try again." });
    }
  };

  // Start editing
  const startEditingTag = (tag: PersonalTag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagDescription(tag.description || "");
    setEditTagType(tag.tag_type);
  };

  // Save edited tag
  const saveEditedTag = async () => {
    const tag = editingTag();
    const name = editTagName().trim();
    const description = editTagDescription().trim();
    const tag_type = editTagType().trim();

    // Validate on submit
    const errors: { name?: string; type?: string; description?: string } = {};
    if (!name) errors.name = "Tag name is required";
    else if (name.length < 2) errors.name = "Tag name must be at least 2 characters";
    if (!tag_type) errors.type = "Tag type is required";
    if (!description) errors.description = "Description is required";

    if (Object.keys(errors).length > 0) {
      setEditTagErrors(errors);
      return;
    }
    setEditTagErrors({});

    if (tag) {
      try {
        await props.onUpdateTag({
          id: tag.id,
          name,
          description,
          tag_type,
        });
        setEditingTag(null);
        setEditTagName("");
        setEditTagDescription("");
        setEditTagType("");
      } catch (error) {
        console.error("Failed to update tag:", error);
        setEditTagErrors({ name: "Failed to update tag. Please try again." });
      }
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingTag(null);
    setEditTagName("");
    setEditTagDescription("");
    setEditTagType("");
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
        <h3 class="text-lg font-semibold text-foreground mb-2">Error Loading Tags</h3>
        <p class="text-muted-foreground mb-4">Unable to load tags. Please try again.</p>
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
            <h2 class="text-2xl font-bold text-foreground mb-2">Travel Tags</h2>
            <p class="text-muted-foreground">
              Curate tags to help the AI understand your vibe. Toggle global tags on or off and add
              personal signals.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="loci-card p-4">
              <p class="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
              <div class="text-2xl font-bold text-foreground">{activeTags().length}</div>
              <p class="text-xs text-muted-foreground">Currently influencing results</p>
            </div>
            <div class="loci-card p-4">
              <p class="text-xs uppercase tracking-wide text-muted-foreground">Personal</p>
              <div class="text-2xl font-bold text-foreground">{personalTags().length}</div>
              <p class="text-xs text-muted-foreground">Your custom signals</p>
            </div>
            <div class="loci-card p-4">
              <p class="text-xs uppercase tracking-wide text-muted-foreground">Global</p>
              <div class="text-2xl font-bold text-foreground">{globalTags().length}</div>
              <p class="text-xs text-muted-foreground">Platform tags available</p>
            </div>
          </div>

          <div class="loci-card p-6">
            {/* Add New Tag Form */}
            <div class="mb-6 pb-6 border-b border-border">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h4 class="font-semibold text-foreground">Manage Tags</h4>
                  <p class="text-sm text-muted-foreground">
                    Add concise, descriptive tags to filter recommendations.
                  </p>
                </div>
                <Show
                  when={!showAddTagForm()}
                  fallback={
                    <button
                      onClick={() => {
                        setShowAddTagForm(false);
                        setNewTagName("");
                        setNewTagDescription("");
                        setNewTagType("");
                        setNewTagErrors({});
                      }}
                      class="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg border border-border"
                    >
                      Cancel
                    </button>
                  }
                >
                  <button
                    onClick={() => setShowAddTagForm(true)}
                    class="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-sm font-semibold shadow-md"
                  >
                    <Plus class="w-4 h-4" />
                    Add New Tag
                  </button>
                </Show>
              </div>

              <Show when={showAddTagForm()}>
                <div class="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="space-y-1">
                      <input
                        type="text"
                        value={newTagName()}
                        onInput={(e) => {
                          setNewTagName(e.target.value);
                          if (newTagErrors().name)
                            setNewTagErrors({ ...newTagErrors(), name: undefined });
                        }}
                        placeholder="Tag name..."
                        class={`w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:border-transparent text-sm bg-background text-foreground transition-colors ${
                          newTagErrors().name
                            ? "border-destructive focus:ring-destructive"
                            : "border-border focus:ring-ring"
                        }`}
                      />
                      <Show when={newTagErrors().name}>
                        <p class="text-xs text-destructive">{newTagErrors().name}</p>
                      </Show>
                    </div>
                    <div class="space-y-1">
                      <input
                        type="text"
                        value={newTagType()}
                        onInput={(e) => {
                          setNewTagType(e.target.value);
                          if (newTagErrors().type)
                            setNewTagErrors({ ...newTagErrors(), type: undefined });
                        }}
                        placeholder="Tag type (e.g., atmosphere, cuisine)..."
                        class={`w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:border-transparent text-sm bg-background text-foreground transition-colors ${
                          newTagErrors().type
                            ? "border-destructive focus:ring-destructive"
                            : "border-border focus:ring-ring"
                        }`}
                      />
                      <Show when={newTagErrors().type}>
                        <p class="text-xs text-destructive">{newTagErrors().type}</p>
                      </Show>
                    </div>
                    <button
                      onClick={handleCreateTag}
                      disabled={props.isCreating}
                      class="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold shadow-sm"
                    >
                      {props.isCreating ? "Adding..." : "Add"}
                    </button>
                  </div>
                  <div class="space-y-1">
                    <textarea
                      value={newTagDescription()}
                      onInput={(e) => {
                        setNewTagDescription(e.target.value);
                        if (newTagErrors().description)
                          setNewTagErrors({ ...newTagErrors(), description: undefined });
                      }}
                      placeholder="Tag description..."
                      rows={2}
                      class={`w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:border-transparent text-sm bg-background text-foreground transition-colors ${
                        newTagErrors().description
                          ? "border-destructive focus:ring-destructive"
                          : "border-border focus:ring-ring"
                      }`}
                    />
                    <Show when={newTagErrors().description}>
                      <p class="text-xs text-destructive">{newTagErrors().description}</p>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>

            {/* Tags Grid */}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <For each={props.tags}>
                {(tag) => (
                  <Show
                    when={editingTag()?.id === tag.id}
                    fallback={
                      <div class="group relative tag-action-container overflow-hidden loci-card hover:shadow-md transition-all duration-200">
                        <div class="absolute inset-x-0 top-0 h-1 bg-primary" />
                        <div
                          onClick={() => {
                            if (tag.source === "personal" && window.innerWidth < 640) {
                              setActiveTagForActions(
                                activeTagForActions() === tag.id ? null : tag.id,
                              );
                            }
                          }}
                          class={`p-4 space-y-3 ${activeTagForActions() === tag.id ? "ring-2 ring-primary/30" : ""}`}
                        >
                          <div class="flex items-start justify-between gap-3">
                            <div class="space-y-1">
                              <div class="flex items-center gap-2">
                                <h4 class="font-semibold text-foreground">{tag.name}</h4>
                                <span class="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                                  {tag.tag_type}
                                </span>
                              </div>
                              <p class="text-sm text-muted-foreground line-clamp-2">
                                {tag.description || "No description"}
                              </p>
                            </div>
                            <div class="flex flex-col items-end gap-2">
                              <Show when={tag.source === "global"}>
                                <span class="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold border border-primary/20">
                                  Global
                                </span>
                              </Show>
                              <span
                                class={`px-2 py-1 rounded-full text-xs font-semibold border ${
                                  (tag.active ?? false)
                                    ? "bg-accent/10 text-accent border-accent/20"
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {(tag.active ?? false) ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </div>

                          <div class="flex items-center justify-between">
                            <Switch
                              checked={tag.active ?? false}
                              onChange={() => props.onToggleActive(tag)}
                              disabled={props.isToggling}
                            />

                            <Show when={tag.source === "personal"}>
                              <div class="hidden sm:flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditingTag(tag);
                                  }}
                                  class="px-3 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 text-xs font-semibold border border-border"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    props.onDeleteTag(tag);
                                  }}
                                  class="px-3 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-semibold border border-destructive/20"
                                >
                                  Delete
                                </button>
                              </div>
                            </Show>
                          </div>
                        </div>

                        {/* Mobile actions */}
                        <Show when={tag.source === "personal" && activeTagForActions() === tag.id}>
                          <div class="sm:hidden px-3 pb-3 space-y-2">
                            <div class="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingTag(tag);
                                  setActiveTagForActions(null);
                                }}
                                class="flex-1 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-semibold"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  props.onDeleteTag(tag);
                                  setActiveTagForActions(null);
                                }}
                                class="flex-1 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </Show>
                      </div>
                    }
                  >
                    {/* Edit Form */}
                    <div class="p-4 bg-muted rounded-2xl border-2 border-border shadow-inner space-y-3">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editTagName()}
                          onInput={(e) => setEditTagName(e.target.value)}
                          placeholder="Tag name..."
                          class="px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground"
                        />
                        <input
                          type="text"
                          value={editTagType()}
                          onInput={(e) => setEditTagType(e.target.value)}
                          placeholder="Tag type..."
                          class="px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground"
                        />
                      </div>
                      <textarea
                        value={editTagDescription()}
                        onInput={(e) => setEditTagDescription(e.target.value)}
                        placeholder="Tag description..."
                        rows={2}
                        class="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground"
                      />
                      <div class="flex gap-2">
                        <button
                          onClick={saveEditedTag}
                          disabled={props.isUpdating}
                          class="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 flex items-center gap-1 disabled:opacity-50"
                        >
                          <Save class="w-3 h-3" />
                          {props.isUpdating ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEditing}
                          class="px-3 py-2 rounded-xl bg-muted text-foreground text-sm font-semibold flex items-center gap-1"
                        >
                          <X class="w-3 h-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </Show>
                )}
              </For>
            </div>

            <Show when={props.tags.length === 0}>
              <div class="text-center py-10">
                <p class="text-muted-foreground">
                  No tags yet. Add your first one to start shaping recommendations.
                </p>
              </div>
            </Show>

            {/* Active Tags Summary */}
            <Show when={props.tags.length > 0}>
              <div class="mt-8 pt-6 border-t border-border">
                <h4 class="font-semibold text-foreground mb-4">
                  Active Tags ({activeTags().length})
                </h4>
                <Show when={activeTags().length === 0}>
                  <p class="text-muted-foreground text-sm">
                    No active tags. Activate some tags above to see them here.
                  </p>
                </Show>
                <Show when={activeTags().length > 0}>
                  <div class="flex flex-wrap gap-2">
                    <For each={activeTags()}>
                      {(tag) => (
                        <span
                          class={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${
                            tag.source === "global"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-accent/10 text-accent border-accent/20"
                          }`}
                        >
                          {tag.name}
                          <span class="text-xs opacity-75">({tag.tag_type})</span>
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
