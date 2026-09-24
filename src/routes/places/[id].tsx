import { For, Show, createMemo } from "solid-js";
import { useParams, useSearchParams } from "@solidjs/router";
import { Clock, Tag, Wallet } from "lucide-solid";
import type { FavoriteItem as ProtoFavorite } from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { useAuth } from "~/contexts/AuthContext";
import { usePOIDetails } from "~/lib/api/pois";
import { useFavoritesList, type FavoriteItem } from "~/lib/api/favorites";
import { backFromSaved, decodeParam, isOpenableId } from "~/lib/saved/collect";
import PlaceDetail, { type PlaceSummary, type PlaceTab } from "~/components/results/PlaceDetail";

/** Stored opening hours arrive as a JSON object of day → hours, or not at all. */
const hoursRows = (raw: string | null | undefined): [string, string][] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return [];
    return Object.entries(parsed as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string" && v !== "")
      .map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v as string]);
  } catch {
    return [];
  }
};

/**
 * One saved place that is not a hotel or a restaurant — a sight, a museum, an
 * activity. It reads the stored place when the id names one, and otherwise the
 * snapshot saved with the favourite, so a place saved under an old name-based
 * id still opens instead of dead-ending.
 */
export default function PlaceDetailPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const id = () => decodeParam(params.id);

  // An id that is not a UUID names no stored place; asking would only fail.
  const poiQuery = usePOIDetails(isOpenableId(id()) ? id() : "");
  const favoritesQuery = useFavoritesList({ enabled: () => isAuthenticated() });

  // Guarded reads: touching `.data` while pending suspends to the app-wide
  // <Suspense> and flashes the whole route.
  const poi = () => (poiQuery.isSuccess ? (poiQuery.data ?? undefined) : undefined);
  const saved = createMemo<ProtoFavorite | undefined>(() => {
    if (!favoritesQuery.isSuccess) return undefined;
    const list = (favoritesQuery.data?.favorites ?? []) as ProtoFavorite[];
    return list.find((f) => f.itemId === id());
  });

  const place = createMemo<PlaceSummary | undefined>(() => {
    const p = poi();
    const s = saved();
    if (!p && !s) return undefined;
    return {
      id: id(),
      name: p?.name || s?.itemName || "",
      city: p?.city || s?.cityName || undefined,
      category: p?.category || s?.category || undefined,
      description: p?.description || s?.description || undefined,
      latitude: p?.latitude || s?.latitude || undefined,
      longitude: p?.longitude || s?.longitude || undefined,
      address: p?.address || undefined,
      rating: p?.rating || s?.rating || undefined,
      images: p?.images,
      image_credits: p?.image_credits,
      phone: p?.phone_number || undefined,
      website: p?.website || undefined,
    };
  });

  const poiSettled = () => !isOpenableId(id()) || !poiQuery.isPending;
  const favoritesSettled = () => !isAuthenticated() || !favoritesQuery.isPending;

  // Pending until whichever source can still answer has answered; not found
  // only once both have had their say and neither knows the place.
  const status = {
    get isPending() {
      return !place() && !(poiSettled() && favoritesSettled());
    },
    get isError() {
      return !place() && poiSettled() && favoritesSettled();
    },
    get error() {
      return new Error("Place not found");
    },
    refetch: () => {
      void poiQuery.refetch();
      void favoritesQuery.refetch();
    },
  };

  const favorite = createMemo<FavoriteItem | undefined>(() => {
    const p = place();
    if (!p) return undefined;
    return {
      id: p.id,
      name: p.name,
      contentType: "poi",
      description: p.description,
      cityName: p.city,
      latitude: p.latitude,
      longitude: p.longitude,
      rating: p.rating,
      category: p.category,
    };
  });

  const price = () => poi()?.price_range || poi()?.price_level;
  const hours = createMemo(() => hoursRows(poi()?.opening_hours));

  const tabs = createMemo<PlaceTab[]>(() => [
    {
      id: "overview",
      label: "Overview",
      content: () => (
        <div class="space-y-6">
          <Show when={place()?.description}>
            <section class="bg-card rounded-2xl p-6 border border-border">
              <h2 class="text-lg font-semibold text-foreground mb-3">About this place</h2>
              <p class="text-muted-foreground leading-relaxed">{place()?.description}</p>
            </section>
          </Show>
          <Show when={saved()?.notes}>
            <section class="bg-card rounded-2xl p-6 border border-border">
              <h2 class="text-lg font-semibold text-foreground mb-3">Your notes</h2>
              <p class="text-muted-foreground leading-relaxed whitespace-pre-line">
                {saved()?.notes}
              </p>
            </section>
          </Show>
          <Show when={hours().length > 0 || price()}>
            <section class="bg-card rounded-2xl p-6 border border-border">
              <h2 class="text-lg font-semibold text-foreground mb-4">Plan your visit</h2>
              <Show when={price()}>
                <p class="flex items-center gap-2 text-sm text-foreground mb-3">
                  <Wallet class="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  {price()}
                </p>
              </Show>
              <Show when={hours().length > 0}>
                <div class="flex items-start gap-2 text-sm">
                  <Clock class="w-4 h-4 mt-0.5 text-muted-foreground" aria-hidden="true" />
                  <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                    <For each={hours()}>
                      {([day, h]) => (
                        <>
                          <dt class="text-muted-foreground">{day}</dt>
                          <dd class="text-foreground">{h}</dd>
                        </>
                      )}
                    </For>
                  </dl>
                </div>
              </Show>
            </section>
          </Show>
          <Show when={poi()?.tags?.length}>
            <ul class="flex flex-wrap gap-2" aria-label="Tags">
              <For each={poi()?.tags}>
                {(t) => (
                  <li class="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    <Tag class="w-3 h-3" aria-hidden="true" />
                    {t}
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <Show when={!place()?.description && !saved()?.notes && !hours().length && !price()}>
            <p class="text-sm text-muted-foreground">
              Loci has no more detail on this place yet. The Location tab has directions.
            </p>
          </Show>
        </div>
      ),
    },
  ]);

  return (
    <PlaceDetail
      domain="activities"
      status={status}
      place={place()}
      favorite={favorite()}
      cityHint={searchParams.cityName as string | undefined}
      backTo={backFromSaved(searchParams.from)}
      tabs={tabs()}
    />
  );
}
