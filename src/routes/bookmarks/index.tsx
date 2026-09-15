import { createSignal, createMemo, For, Show, onMount } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import {
  Bookmark,
  FolderOpen,
  Loader2,
  Trash2,
  MapPin,
  Calendar,
  WifiOff,
  Wifi,
} from "lucide-solid";
import { A } from "@solidjs/router";
import { useAuth } from "~/contexts/AuthContext";
import {
  listOfflineItineraries,
  deleteOfflineItinerary,
  clearOfflineItineraries,
  type OfflineItinerary,
} from "~/lib/itinerary-offline-store";
import {
  useAllUserItineraries,
  useRemoveItineraryMutation,
} from "~/lib/api/itineraries";

type TabId = "saved" | "offline";

export default function BookmarksPage() {
  const [activeTab, setActiveTab] = createSignal<TabId>("saved");
  const [offlineItems, setOfflineItems] = createSignal<OfflineItinerary[]>([]);
  const [offlineLoading, setOfflineLoading] = createSignal(false);
  const { isAuthenticated } = useAuth();

  // ── Server-saved itineraries ──
  const savedQuery = useAllUserItineraries({ enabled: isAuthenticated() });
  const removeItineraryMutation = useRemoveItineraryMutation();

  const savedList = createMemo(() => savedQuery.data?.itineraries || []);
  const savedLoading = createMemo(() => savedQuery.isLoading);
  const savedError = createMemo(() => savedQuery.isError);

  const handleRemoveSaved = async (itineraryId: string, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    removeItineraryMutation.mutate(itineraryId);
  };

  // ── Offline itineraries ──
  const loadOffline = async () => {
    setOfflineLoading(true);
    try {
      const items = await listOfflineItineraries();
      setOfflineItems(items);
    } catch (err) {
      console.error("Failed to load offline itineraries:", err);
    } finally {
      setOfflineLoading(false);
    }
  };

  onMount(loadOffline);

  const handleDeleteOffline = async (id: string, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteOfflineItinerary(id);
      setOfflineItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete offline itinerary:", err);
    }
  };

  const handleClearAllOffline = async () => {
    if (!confirm("Remove all offline-saved itineraries?")) return;
    try {
      await clearOfflineItineraries();
      setOfflineItems([]);
    } catch (err) {
      console.error("Failed to clear offline itineraries:", err);
    }
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

  const TabButton = (props: {
    id: TabId;
    label: string;
    count?: number;
    icon: typeof Bookmark;
  }) => {
    const isActive = () => activeTab() === props.id;
    return (
      <button
        type="button"
        onClick={() => {
          setActiveTab(props.id);
          if (props.id === "offline") void loadOffline();
        }}
        class={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
          isActive()
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        }`}
      >
        <props.icon class="w-4 h-4" />
        {props.label}
        <Show when={props.count != null && props.count > 0}>
          <span
            class={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold ${
              isActive()
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {props.count}
          </span>
        </Show>
      </button>
    );
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
                <A href="/discover" class="loci-hero__action--strong">
                  <FolderOpen class="w-4 h-4" />
                  Discover
                </A>
              </div>

              {/* Tab bar */}
              <div class="flex items-center gap-2 bg-secondary/30 rounded-xl p-1">
                <TabButton id="saved" label="Saved" count={savedList().length} icon={Bookmark} />
                <TabButton
                  id="offline"
                  label="Offline"
                  count={offlineItems().length}
                  icon={WifiOff}
                />
              </div>
            </div>
          </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          {/* ═══ Saved Tab ═══ */}
          <Show when={activeTab() === "saved"}>
            {/* Loading State */}
            <Show when={savedLoading()}>
              <div class="flex items-center justify-center py-16">
                <Loader2 class="w-8 h-8 animate-spin text-primary" />
                <span class="ml-3 text-muted-foreground">Loading your bookmarks...</span>
              </div>
            </Show>

            {/* Error State */}
            <Show when={savedError()}>
              <div class="text-center py-16">
                <div class="text-destructive mb-4">Failed to load bookmarks</div>
                <button
                  onClick={() => savedQuery.refetch()}
                  class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Try Again
                </button>
              </div>
            </Show>

            {/* Not authenticated */}
            <Show when={!isAuthenticated() && !savedLoading()}>
              <div class="text-center py-16">
                <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bookmark class="w-10 h-10 text-primary" />
                </div>
                <h3 class="text-xl font-semibold text-foreground mb-2">Sign in to see bookmarks</h3>
                <p class="text-muted-foreground mb-6 max-w-md mx-auto">
                  Sign in to save itineraries to your account and access them from any device.
                </p>
                <A
                  href="/auth/signin"
                  class="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg"
                >
                  Sign in
                </A>
              </div>
            </Show>

            {/* Empty State */}
            <Show when={isAuthenticated() && !savedLoading() && !savedError() && savedList().length === 0}>
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

            {/* Saved Grid */}
            <Show when={!savedLoading() && savedList().length > 0}>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <For each={savedList()}>
                  {(itinerary: any) => (
                    <div class="loci-card loci-card-interactive p-5 cursor-pointer group">
                      <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                          <h3 class="text-lg font-semibold text-foreground line-clamp-1">
                            {itinerary.title || "Untitled"}
                          </h3>
                          <Show when={itinerary.primary_city_id}>
                            <div class="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <MapPin class="w-3 h-3" />
                              <span>{itinerary.primary_city_id}</span>
                            </div>
                          </Show>
                        </div>
                        <button
                          onClick={(e) => handleRemoveSaved(itinerary.id, e)}
                          disabled={removeItineraryMutation.isPending}
                          class="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove bookmark"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>

                      <Show when={itinerary.description}>
                        <p class="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {itinerary.description}
                        </p>
                      </Show>

                      <div class="flex items-center justify-between text-xs text-muted-foreground">
                        <div class="flex items-center gap-3">
                          <span class="flex items-center gap-1">
                            <Calendar class="w-3 h-3" />
                            {formatDate(itinerary.created_at)}
                          </span>
                          <Show when={itinerary.estimated_duration_days}>
                            <span>{itinerary.estimated_duration_days} days</span>
                          </Show>
                        </div>
                        <span class="flex items-center gap-1 text-primary">
                          <Wifi class="w-3 h-3" />
                          Cloud
                        </span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>

          {/* ═══ Offline Tab ═══ */}
          <Show when={activeTab() === "offline"}>
            {/* Loading */}
            <Show when={offlineLoading()}>
              <div class="flex items-center justify-center py-16">
                <Loader2 class="w-8 h-8 animate-spin text-primary" />
                <span class="ml-3 text-muted-foreground">Loading offline itineraries...</span>
              </div>
            </Show>

            {/* Empty state */}
            <Show when={!offlineLoading() && offlineItems().length === 0}>
              <div class="text-center py-16">
                <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <WifiOff class="w-10 h-10 text-emerald-500" />
                </div>
                <h3 class="text-xl font-semibold text-foreground mb-2">No Offline Itineraries</h3>
                <p class="text-muted-foreground mb-6 max-w-md mx-auto">
                  Save itineraries for offline access by clicking the{" "}
                  <WifiOff class="inline w-4 h-4 text-emerald-500" /> icon on any itinerary page.
                  They'll be available here even without internet.
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

            {/* Offline Grid */}
            <Show when={!offlineLoading() && offlineItems().length > 0}>
              {/* Clear all header */}
              <div class="flex items-center justify-between mb-4">
                <p class="text-sm text-muted-foreground">
                  {offlineItems().length} itinerar{offlineItems().length === 1 ? "y" : "ies"} saved
                  offline
                </p>
                <button
                  type="button"
                  onClick={handleClearAllOffline}
                  class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 class="w-3 h-3" />
                  Clear all
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <For each={offlineItems()}>
                  {(item) => (
                    <A
                      href={item.sourceUrl || `/itinerary?sessionId=${item.id}&cityName=${encodeURIComponent(item.cityName)}`}
                      class="loci-card loci-card-interactive p-5 cursor-pointer group block"
                    >
                      <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                          <h3 class="text-lg font-semibold text-foreground line-clamp-1">
                            {item.title || "Untitled"}
                          </h3>
                          <div class="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <MapPin class="w-3 h-3" />
                            <span>{item.cityName}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => void handleDeleteOffline(item.id, e)}
                          class="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove offline copy"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>

                      <Show when={item.description}>
                        <p class="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {item.description}
                        </p>
                      </Show>

                      <div class="flex items-center justify-between text-xs text-muted-foreground">
                        <div class="flex items-center gap-3">
                          <span class="flex items-center gap-1">
                            <Calendar class="w-3 h-3" />
                            {formatDate(item.savedAt)}
                          </span>
                          <Show when={item.stopCount > 0}>
                            <span>{item.stopCount} stops</span>
                          </Show>
                        </div>
                        <span class="flex items-center gap-1 text-emerald-500 font-medium">
                          <WifiOff class="w-3 h-3" />
                          Offline
                        </span>
                      </div>
                    </A>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </>
  );
}
