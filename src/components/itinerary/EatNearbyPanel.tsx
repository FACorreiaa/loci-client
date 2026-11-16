import { For, Show, createSignal, onMount } from "solid-js";
import { ExternalLink, Plus, Star, Utensils, X } from "lucide-solid";
import { fetchNearbyPlaces } from "@/lib/api/pois";
import { capture } from "@/lib/analytics";
import {
  EAT_CATEGORIES,
  placeDistanceKm,
  EAT_RADIUS_KM,
  eatNearbyGoogleUrl,
  eatNearbySummary,
  filterEatNearby,
  type EatOption,
} from "@/lib/itinerary/eat-nearby";

export interface EatNearbyPanelProps {
  stopName: string;
  cityName?: string;
  latitude?: number;
  longitude?: number;
  /** What is already on the trip, so it is not offered again. */
  onTrip: { poiId?: string; name: string }[];
  /** Absent when the viewer cannot add (signed out, not their trip). */
  onAdd?: (place: EatOption) => void;
  busy?: boolean;
  /** Shown in place of the add button when there is no onAdd. */
  addHint?: string;
  onClose: () => void;
}

/**
 * Somewhere to eat within a short walk of one stop.
 *
 * Only what Loci already has stored; nothing is made up to fill the list, so
 * it can be short or empty and says so. Google's own list is always one tap
 * away, because Loci's places have not been checked against the world.
 */
export default function EatNearbyPanel(props: EatNearbyPanelProps) {
  const hasCoords = () => typeof props.latitude === "number" && typeof props.longitude === "number";

  // Plain signals, fetched once on mount. A resource would be less code, but
  // reading one before it settles suspends to the app-wide Suspense and
  // blanks the itinerary behind the panel.
  const [options, setOptions] = createSignal<EatOption[]>([]);
  const [state, setState] = createSignal<"loading" | "ready" | "failed">("loading");

  onMount(async () => {
    if (!hasCoords()) {
      // No position to search around: the Google link below is all there is.
      setState("ready");
      capture("eat_nearby_opened", { result_count: 0, has_coords: false });
      return;
    }
    try {
      const found = await fetchNearbyPlaces({
        latitude: props.latitude,
        longitude: props.longitude,
        radiusKm: EAT_RADIUS_KM,
        categories: EAT_CATEGORIES,
      });
      const filtered = filterEatNearby(
        found.map((p) => ({
          id: String(p.id ?? ""),
          name: p.name,
          category: p.category,
          address: p.address || undefined,
          rating: p.rating && p.rating > 0 ? p.rating : undefined,
          latitude: Number(p.latitude) || undefined,
          longitude: Number(p.longitude) || undefined,
          distanceKm: placeDistanceKm(
            typeof p.distance === "number" ? p.distance : undefined,
            { latitude: props.latitude, longitude: props.longitude },
            {
              latitude: Number(p.latitude) || undefined,
              longitude: Number(p.longitude) || undefined,
            },
          ),
          description: p.description_poi || p.description || undefined,
        })),
        props.onTrip,
      );
      setOptions(filtered);
      setState("ready");
      capture("eat_nearby_opened", { result_count: filtered.length, has_coords: true });
    } catch {
      setState("failed");
    }
  });

  const googleHref = () => eatNearbyGoogleUrl(props.stopName, props.cityName);

  return (
    <section
      class="rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm"
      aria-label={`Places to eat near ${props.stopName}`}
    >
      <div class="mb-2 flex items-start justify-between gap-3">
        <p class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Utensils class="h-4 w-4 text-primary" />
          Eat near {props.stopName}
        </p>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
          onClick={() => props.onClose()}
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <Show
        when={hasCoords()}
        fallback={
          <p class="text-sm text-muted-foreground">
            Loci doesn't know where {props.stopName} is on the map, so it can't look around it.
          </p>
        }
      >
        <Show when={state() === "loading"}>
          <p class="text-sm text-muted-foreground">Looking…</p>
        </Show>
        <Show when={state() === "failed"}>
          <p class="text-sm text-destructive" role="alert">
            Couldn't look for places just now.
          </p>
        </Show>
        <Show when={state() === "ready"}>
          <p class="text-xs text-muted-foreground">
            {eatNearbySummary(options().length, props.stopName)}
          </p>
          <Show when={options().length > 0}>
            <ul class="mt-2 divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
              <For each={options()}>
                {(place) => (
                  <li class="flex items-center gap-3 bg-background/70 px-3 py-2.5">
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium text-foreground">
                        {place.name}
                      </span>
                      <span class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <Show when={place.walkMinutes}>
                          <span>{place.walkMinutes} min walk</span>
                        </Show>
                        <Show when={place.category}>
                          <span class="capitalize">{place.category}</span>
                        </Show>
                        <Show when={place.rating}>
                          <span class="inline-flex items-center gap-0.5">
                            <Star class="h-3 w-3 fill-current text-accent" />
                            {place.rating!.toFixed(1)}
                          </span>
                        </Show>
                      </span>
                    </span>
                    <Show when={props.onAdd}>
                      <button
                        type="button"
                        class="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        disabled={props.busy}
                        aria-label={`Add ${place.name} after ${props.stopName}`}
                        onClick={() => props.onAdd?.(place)}
                      >
                        <Plus class="h-3.5 w-3.5" />
                        Add after
                      </button>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
            <Show when={!props.onAdd && props.addHint}>
              <p class="mt-2 text-xs text-muted-foreground">{props.addHint}</p>
            </Show>
          </Show>
        </Show>
      </Show>

      <a
        href={googleHref()}
        target="_blank"
        rel="noopener noreferrer"
        class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ExternalLink class="h-3.5 w-3.5" />
        See restaurants near here on Google Maps
      </a>
    </section>
  );
}
