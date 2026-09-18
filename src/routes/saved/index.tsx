import { createMemo, createSignal, For, Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import { Loader2 } from "lucide-solid";
import { useAuth } from "~/contexts/AuthContext";
import { deleteOfflineItinerary } from "~/lib/itinerary-offline-store";
import { useRemoveFromFavorites } from "~/lib/api/favorites";
import { useRemoveItineraryMutation } from "~/lib/api/itineraries";
import { contentTypeToString } from "~/lib/saved/content-type";
import { filterSaved } from "~/lib/saved/collect";
import { useSavedItems } from "~/lib/saved/use-saved-items";
import { isSavedView, type SavedItem, type SavedView } from "~/lib/saved/types";
import SavedFilters from "~/components/saved/SavedFilters";
import SavedRow from "~/components/saved/SavedRow";
import SectionHeader from "~/components/ui/SectionHeader";

const panel = "mt-4 rounded-xl border border-dashed border-border bg-card/70 px-5 py-10";

/**
 * Everything a person kept, in one place: saved places from the account and
 * itineraries from both the account and this device.
 *
 * This replaces /favorites and /bookmarks, which showed slices of the same
 * collection in two different visual languages, and neither of which could
 * tell "nothing saved" apart from "we could not ask".
 */
export default function SavedPage() {
  const { isAuthenticated } = useAuth();
  const { items, counts, status, errors } = useSavedItems();
  const [searchParams, setSearchParams] = useSearchParams();

  // The chip lives in the URL so the back button and a reload both work.
  const view = createMemo<SavedView>(() => {
    const v = Array.isArray(searchParams.view) ? searchParams.view[0] : searchParams.view;
    return isSavedView(v) ? v : "all";
  });
  const visible = createMemo(() => filterSaved(items(), view()));

  const removeFavorite = useRemoveFromFavorites();
  const removeCloudItinerary = useRemoveItineraryMutation();
  const [removingKey, setRemovingKey] = createSignal<string | null>(null);
  const [removeError, setRemoveError] = createSignal<string | null>(null);

  const remove = async (item: SavedItem) => {
    setRemovingKey(item.key);
    setRemoveError(null);
    try {
      if (item.kind === "place") {
        // Both values come from the server's own row. Recomputing either one
        // is how un-favouriting used to delete nothing: a hard-coded "poi"
        // content type never matched a saved hotel or restaurant.
        await removeFavorite.mutateAsync({
          itemId: item.itemId,
          contentType: contentTypeToString(item.contentType),
        });
      } else {
        if (item.offlineId) await deleteOfflineItinerary(item.offlineId);
        if (item.cloudId) await removeCloudItinerary.mutateAsync(item.cloudId);
      }
    } catch {
      setRemoveError("That could not be removed. Try again in a moment.");
    } finally {
      setRemovingKey(null);
    }
  };

  return (
    <>
      <Title>Saved · Loci</Title>
      <Meta
        name="description"
        content="Places and itineraries you kept, on this device and in your account."
      />

      <div class="mx-auto w-full max-w-4xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <SectionHeader
          kicker="kept"
          title="Saved"
          subtitle="Places you starred and itineraries you kept. Copies on this device open without a connection."
          size="lg"
          action={
            <A href="/discover" class="text-sm font-medium text-primary hover:underline">
              Plan another
            </A>
          }
        />

        <Show
          when={status() !== "loading"}
          fallback={<Loader2 class="mt-6 h-6 w-6 animate-spin text-primary" />}
        >
          <Show
            when={status() !== "signed-out"}
            fallback={
              <div class={panel}>
                <p class="font-display text-lg text-foreground">Sign in to see what you saved</p>
                <p class="mt-2 max-w-md text-sm text-muted-foreground">
                  Your saved places and itineraries live with your account. Anything kept on this
                  device will show here too.
                </p>
                <A href="/auth/signin" class="mt-4 inline-block text-sm font-medium text-primary">
                  Sign in
                </A>
              </div>
            }
          >
            <Show
              when={status() !== "error"}
              fallback={
                <div class={panel}>
                  <p class="font-display text-lg text-foreground">
                    We could not load what you saved
                  </p>
                  <p class="mt-2 max-w-md text-sm text-muted-foreground">
                    The connection to your account failed. Nothing has been lost — try again in a
                    moment.
                  </p>
                </div>
              }
            >
              <SavedFilters
                active={view()}
                counts={counts()}
                onSelect={(v) => setSearchParams({ view: v })}
              />

              {/* A partial failure names exactly what is missing, rather than
                  blanking a list that is still mostly right. */}
              <Show when={errors().places}>
                <p class="mb-3 text-sm text-muted-foreground">
                  Saved places could not be loaded. Your itineraries are listed.
                </p>
              </Show>
              <Show when={errors().itineraries}>
                <p class="mb-3 text-sm text-muted-foreground">
                  Account itineraries could not be loaded. What is on this device is listed.
                </p>
              </Show>
              <Show when={removeError()}>
                <p class="mb-3 text-sm text-destructive">{removeError()}</p>
              </Show>

              <Show
                when={visible().length > 0}
                fallback={
                  <div class={panel}>
                    <p class="font-display text-lg text-foreground">
                      {items().length === 0 ? "Nothing kept yet" : "Nothing under this filter"}
                    </p>
                    <p class="mt-2 max-w-md text-sm text-muted-foreground">
                      {items().length === 0
                        ? "Star a place or press Save on an itinerary. It stays on this device, and in your account when you are signed in."
                        : "Try another filter, or start something new."}
                    </p>
                    <A href="/discover" class="mt-4 inline-block text-sm font-medium text-primary">
                      Open Discover
                    </A>
                  </div>
                }
              >
                <ul class="divide-y divide-border border-t border-border">
                  <For each={visible()}>
                    {(item) => (
                      <SavedRow
                        item={item}
                        removing={removingKey() === item.key}
                        onRemove={(i) => void remove(i)}
                      />
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </Show>
        </Show>

        <Show when={isAuthenticated()}>
          <p class="mt-10 text-xs text-muted-foreground">
            Account bookmarks keep the title only; the full itinerary lives on the device that saved
            it.
          </p>
        </Show>
      </div>
    </>
  );
}
