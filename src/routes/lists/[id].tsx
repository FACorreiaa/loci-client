import { createMemo, createSignal, For, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { A, useParams } from "@solidjs/router";
import { ArrowLeft, Globe, Loader2, Lock, MapPin, Star, Trash2 } from "lucide-solid";
import { lazyChunk } from "~/lib/lazyChunk";
import { useList, useRemoveFromListMutation } from "~/lib/api/lists";
import type { ListDetailItem } from "~/lib/lists/list-detail";
import { friendlyError } from "~/lib/connect-errors";
import { ErrorView } from "~/components/ErrorView";
import type { POI } from "~/components/features/Map/types";

// Lazy + data-gated <Show>, like every other map call site: keeps mapbox-gl out
// of the server bundle.
const MapComponent = lazyChunk(() => import("~/components/features/Map/Map"));

const KIND_LABEL: Record<ListDetailItem["kind"], string> = {
  poi: "Place",
  restaurant: "Restaurant",
  hotel: "Hotel",
  itinerary: "Itinerary",
};

/**
 * One list: its places on a map and in order, each removable.
 *
 * /lists linked here ("View List") but the route did not exist, so every list
 * was a dead end. GetList with include_detailed_items resolves each item to
 * its place (proto v5.28.0).
 */
export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  const listQuery = useList(() => params.id);
  const remove = useRemoveFromListMutation();
  const [selectedId, setSelectedId] = createSignal<string>();
  const [removeError, setRemoveError] = createSignal<string | null>(null);

  const list = () => listQuery.data ?? null;
  const items = () => list()?.items ?? [];

  const points = createMemo<POI[]>(() =>
    items()
      .filter((i) => i.latitude !== undefined && i.longitude !== undefined)
      .map((i, idx) => ({
        id: i.itemId,
        name: i.name,
        category: i.category,
        latitude: i.latitude!,
        longitude: i.longitude!,
        rating: i.rating || undefined,
        seq: idx + 1,
      })),
  );
  const center = createMemo<[number, number] | null>(() => {
    const first = points()[0];
    return first ? [Number(first.longitude), Number(first.latitude)] : null;
  });

  const removeItem = (item: ListDetailItem) => {
    setRemoveError(null);
    remove.mutate(
      { listId: params.id, itemId: item.itemId, contentType: item.kind },
      {
        onError: (err) =>
          setRemoveError(`Couldn't remove ${item.name}. ${friendlyError(err).message}`),
      },
    );
  };

  const itemHref = (item: ListDetailItem) =>
    item.kind === "itinerary" ? undefined : `/places/${item.itemId}`;

  return (
    <main class="mx-auto w-full max-w-6xl px-4 py-8">
      <Title>{list()?.name ? `${list()!.name} | Loci` : "List | Loci"}</Title>

      <A
        href="/lists"
        class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft class="h-4 w-4" /> All lists
      </A>

      <Show when={listQuery.isLoading}>
        <div class="flex items-center justify-center py-16" aria-busy="true">
          <Loader2 class="h-6 w-6 animate-spin text-primary" />
          <span class="ml-3 text-muted-foreground">Loading the list…</span>
        </div>
      </Show>

      <Show when={listQuery.isError}>
        <ErrorView class="my-6" error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      </Show>

      <Show when={listQuery.isSuccess && !list()}>
        <p class="mt-8 text-sm text-muted-foreground">
          That list doesn&apos;t exist, or it isn&apos;t yours.{" "}
          <A href="/lists" class="underline">
            Back to your lists
          </A>
        </p>
      </Show>

      <Show when={list()}>
        {(l) => (
          <>
            <header class="mt-3">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="editorial-title">{l().name}</h1>
                <span title={l().isPublic ? "Public" : "Private"}>
                  {l().isPublic ? (
                    <Globe class="h-4 w-4 text-accent" />
                  ) : (
                    <Lock class="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <Show when={l().isItinerary}>
                  <span class="loci-chip loci-chip--surface text-xs">Itinerary</span>
                </Show>
              </div>
              <Show when={l().description}>
                <p class="editorial-lead mt-2 max-w-2xl">{l().description}</p>
              </Show>
              <p class="mt-2 text-sm text-muted-foreground">
                {items().length} {items().length === 1 ? "item" : "items"}
              </p>
            </header>

            <Show when={removeError()}>
              <p class="mt-4 text-sm text-destructive" role="alert">
                {removeError()}
              </p>
            </Show>

            <Show
              when={items().length > 0}
              fallback={
                <div class="loci-card mt-6 p-6 text-center">
                  <p class="font-medium">Nothing in this list yet.</p>
                  <p class="mt-1 text-sm text-muted-foreground">
                    Use &ldquo;Add to list&rdquo; on any place, from a search or its own page.
                  </p>
                  <A href="/discover" class="mt-3 inline-block text-sm text-primary underline">
                    Discover places
                  </A>
                </div>
              }
            >
              <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <ol class="space-y-3">
                  <For each={items()}>
                    {(item, i) => (
                      <li
                        class={`loci-card flex gap-3 p-3 ${selectedId() === item.itemId ? "ring-2 ring-primary" : ""}`}
                        onClick={() => setSelectedId(item.itemId)}
                      >
                        <Show
                          when={item.photo}
                          fallback={
                            <div class="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                              {i() + 1}
                            </div>
                          }
                        >
                          <img
                            src={item.photo}
                            alt=""
                            loading="lazy"
                            class="h-16 w-16 shrink-0 rounded-lg object-cover"
                          />
                        </Show>
                        <div class="min-w-0 flex-1">
                          <Show
                            when={itemHref(item)}
                            fallback={<p class="truncate font-medium">{item.name}</p>}
                          >
                            {(href) => (
                              <A href={href()} class="block truncate font-medium hover:underline">
                                {item.name}
                              </A>
                            )}
                          </Show>
                          <p class="truncate text-xs text-muted-foreground">
                            {[KIND_LABEL[item.kind], item.category, item.address]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <Show when={item.rating > 0}>
                            <p class="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Star class="h-3 w-3" /> {item.rating.toFixed(1)}
                            </p>
                          </Show>
                          <Show when={item.notes || item.description}>
                            <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {item.notes || item.description}
                            </p>
                          </Show>
                        </div>
                        <button
                          type="button"
                          class="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          aria-label={`Remove ${item.name} from this list`}
                          disabled={remove.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(item);
                          }}
                        >
                          <Trash2 class="h-4 w-4" />
                        </button>
                      </li>
                    )}
                  </For>
                </ol>

                <Show
                  when={center()}
                  fallback={
                    <p class="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin class="h-4 w-4" /> None of these places has a position yet.
                    </p>
                  }
                >
                  <div class="h-[50vh] overflow-hidden rounded-2xl border border-border lg:sticky lg:top-24 lg:h-[70vh]">
                    <MapComponent
                      center={center()!}
                      zoom={12}
                      pointsOfInterest={points()}
                      selectedId={selectedId()}
                      onSelect={(poi) => setSelectedId(poi.id)}
                    />
                  </div>
                </Show>
              </div>
            </Show>
          </>
        )}
      </Show>
    </main>
  );
}
