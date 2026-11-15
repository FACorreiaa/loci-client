import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { Plus } from "lucide-solid";
import { fetchNearbyPlaces } from "@/lib/api/pois";
import {
  DAY_SUGGESTIONS,
  NEARBY_RADIUS_KM,
  pickDaySuggestions,
  type Coord,
  type DaySuggestion,
  type SuggestionCandidate,
} from "@/lib/itinerary/day-suggestions";

export interface DaySuggestionsProps {
  dayLabel: string;
  /** The middle of the day's stops; undefined when none of them is placed. */
  centroid?: Coord;
  /** Names of everything on the trip. */
  onTrip: string[];
  /** Places the generation found that are not on the trip. */
  extras: SuggestionCandidate[];
  busy?: boolean;
  onAdd: (place: DaySuggestion) => void;
}

/**
 * A few places a day could take, one tap each.
 *
 * The generation's leftovers are free, so they show at once. Only when they
 * are not enough is Loci asked what else it has stored around the day, once,
 * when this row first appears. Nothing is generated; an empty row is no row.
 */
export default function DaySuggestions(props: DaySuggestionsProps) {
  const [nearby, setNearby] = createSignal<SuggestionCandidate[]>([]);

  const picks = createMemo(() =>
    pickDaySuggestions({
      centroid: props.centroid,
      onTrip: props.onTrip,
      extras: props.extras,
      nearby: nearby(),
    }),
  );

  onMount(async () => {
    const at = props.centroid;
    if (!at || picks().length >= DAY_SUGGESTIONS) return;
    try {
      const found = await fetchNearbyPlaces({ ...at, radiusKm: NEARBY_RADIUS_KM });
      setNearby(
        found.map((p) => ({
          id: p.id ? String(p.id) : undefined,
          name: p.name,
          category: p.category,
          rating: p.rating && p.rating > 0 ? p.rating : undefined,
          latitude: Number(p.latitude) || undefined,
          longitude: Number(p.longitude) || undefined,
          address: p.address || undefined,
        })),
      );
    } catch {
      // The row is a nicety: with no nearby listing it shows the extras, or nothing.
    }
  });

  return (
    <Show when={picks().length > 0}>
      <div aria-label={`Places that could fit ${props.dayLabel}`}>
        <p class="mb-1.5 text-xs font-medium text-muted-foreground">Also near {props.dayLabel}</p>
        <ul class="flex flex-wrap gap-2">
          <For each={picks()}>
            {(place) => (
              <li>
                <button
                  type="button"
                  class="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  disabled={props.busy}
                  aria-label={`Add ${place.name} to ${props.dayLabel}`}
                  onClick={() => props.onAdd(place)}
                >
                  <Plus class="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span class="truncate">{place.name}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  );
}
