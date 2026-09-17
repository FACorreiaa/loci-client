import { createMemo, createResource, For, Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { Bookmark, Loader2, Trash2, Cloud, Smartphone } from "lucide-solid";
import { useAuth } from "~/contexts/AuthContext";
import { deleteOfflineItinerary, listOfflineItineraries } from "~/lib/itinerary-offline-store";
import { useAllUserItineraries, useRemoveItineraryMutation } from "~/lib/api/itineraries";
import { mergeSavedItineraries, type SavedItinerary } from "~/lib/saved-itineraries";
import SectionHeader from "~/components/ui/SectionHeader";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/**
 * Everything a person kept, in one list. Copies on this device open with no
 * network; account bookmarks fold into them by title and city, or stand on
 * their own when the device has no copy.
 */
export default function BookmarksPage() {
  const { isAuthenticated } = useAuth();
  // The query is enabled by an accessor so it runs once auth settles, not
  // only if auth was already known when the page mounted.
  const savedQuery = useAllUserItineraries({ enabled: () => isAuthenticated() });
  const removeCloud = useRemoveItineraryMutation();

  const [offline, { mutate: setOffline }] = createResource(
    () => listOfflineItineraries().catch(() => []),
    { initialValue: [] },
  );

  // Guarded read: `.data` suspends while pending, up to the app-wide <Suspense>.
  const cloud = () => (savedQuery.isSuccess ? (savedQuery.data?.itineraries ?? []) : []);
  const items = createMemo<SavedItinerary[]>(() => mergeSavedItineraries(offline(), cloud()));
  const settled = () => !offline.loading && (!isAuthenticated() || !savedQuery.isLoading);

  const remove = async (item: SavedItinerary, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.offlineId) {
      try {
        await deleteOfflineItinerary(item.offlineId);
        setOffline((list) => list.filter((o) => o.id !== item.offlineId));
      } catch (err) {
        console.error("Could not remove the offline copy:", err);
      }
    }
    if (item.cloudId) removeCloud.mutate(item.cloudId);
  };

  return (
    <>
      <Title>Saved itineraries · Loci</Title>
      <Meta
        name="description"
        content="Itineraries you kept, on this device and in your account."
      />

      <div class="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <SectionHeader
          kicker="kept"
          title="Saved itineraries"
          subtitle="Copies on this device open without a connection."
          size="lg"
          action={
            <A href="/discover" class="text-sm font-medium text-primary hover:underline">
              Plan another
            </A>
          }
        />

        <Show
          when={settled()}
          fallback={<Loader2 class="mt-6 h-6 w-6 animate-spin text-primary" />}
        >
          <Show
            when={items().length > 0}
            fallback={
              <div class="mt-4 rounded-xl border border-dashed border-border bg-card/70 px-5 py-10">
                <p class="font-display text-lg text-foreground">Nothing kept yet</p>
                <p class="mt-2 max-w-md text-sm text-muted-foreground">
                  Open an itinerary and press Save. It stays on this device, and in your account
                  when you are signed in.
                </p>
                <A href="/discover" class="mt-4 inline-block text-sm font-medium text-primary">
                  Open Discover
                </A>
              </div>
            }
          >
            <Show when={savedQuery.isError}>
              <p class="mb-4 text-sm text-muted-foreground">
                Account bookmarks could not be loaded. What is on this device is listed.
              </p>
            </Show>
            <ul class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <For each={items()}>
                {(item) => {
                  const body = (
                    <>
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <h3 class="truncate text-lg text-foreground">
                            {item.title || "Untitled"}
                          </h3>
                          <Show when={item.cityName}>
                            <p class="mt-0.5 text-sm text-muted-foreground">{item.cityName}</p>
                          </Show>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => void remove(item, e)}
                          class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Remove"
                          aria-label={`Remove ${item.title}`}
                        >
                          <Trash2 class="h-4 w-4" />
                        </button>
                      </div>
                      <Show when={item.description}>
                        <p class="mt-3 line-clamp-2 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </Show>
                      <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-coord text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        <Show when={item.savedAt}>
                          <span>{formatDate(item.savedAt)}</span>
                        </Show>
                        <Show when={item.stopCount}>
                          <span>{item.stopCount} stops</span>
                        </Show>
                        <Show when={item.offlineId}>
                          <span class="inline-flex items-center gap-1 text-primary">
                            <Smartphone class="h-3 w-3" aria-hidden="true" />
                            On this device
                          </span>
                        </Show>
                        <Show when={item.cloudId}>
                          <span class="inline-flex items-center gap-1">
                            <Cloud class="h-3 w-3" aria-hidden="true" />
                            Account
                          </span>
                        </Show>
                        <Show when={!item.href}>
                          <span>Not on this device</span>
                        </Show>
                      </div>
                    </>
                  );
                  return (
                    <li>
                      <Show
                        when={item.href}
                        fallback={<div class="loci-card block p-5 opacity-80">{body}</div>}
                      >
                        {(href) => (
                          <A href={href()} class="loci-card loci-card-interactive block p-5">
                            {body}
                          </A>
                        )}
                      </Show>
                    </li>
                  );
                }}
              </For>
            </ul>
          </Show>
        </Show>

        <p class="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
          <Bookmark class="h-3.5 w-3.5" aria-hidden="true" />
          Account bookmarks keep the title and city only; the full itinerary lives on the device
          that saved it.
        </p>
      </div>
    </>
  );
}
