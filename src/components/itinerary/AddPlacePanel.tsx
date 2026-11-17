import { For, Show, createSignal } from "solid-js";
import { Link2, MapPin, Search, X } from "lucide-solid";
import PlacePicker from "@/components/trip/PlacePicker";
import { importPlacesFromLink } from "@/lib/api/link-import";
import { importErrorMessage, type ImportedPlaceView } from "@/lib/import/link-import";
import type { NewStop } from "@/lib/itinerary/createTripView";

export type AddMethod = "search" | "link" | "named";

export interface AddPlacePanelProps {
  dayLabel: string;
  cityName?: string;
  busy?: boolean;
  /** Resolves true when the stop was added; the panel closes itself then. */
  onAdd: (stop: NewStop, method: AddMethod, knownPlace: boolean) => Promise<boolean>;
  onClose: () => void;
}

/** A place a link named, as the stop it would become. */
export function stopFromImported(place: ImportedPlaceView): NewStop {
  // A place Loci knows is added as that place, under Loci's name for it.
  if (place.poiId) return { name: place.poiName || place.name, poiId: place.poiId };
  // One it does not know keeps what the link said: its name, and where it is.
  const placed = typeof place.latitude === "number" && typeof place.longitude === "number";
  return {
    name: place.name,
    notes: place.note || undefined,
    latitude: placed ? place.latitude : undefined,
    longitude: placed ? place.longitude : undefined,
    address: place.address,
  };
}

/**
 * Add a place to one day: find it by name, or paste a link to it.
 *
 * A name Loci does not know can still be added as a stop by that name, and a
 * pasted place Loci does not know keeps the position its link gave, so
 * neither path dead-ends on "not found".
 */
export default function AddPlacePanel(props: AddPlacePanelProps) {
  const [tab, setTab] = createSignal<"search" | "link">("search");
  const [url, setUrl] = createSignal("");
  const [reading, setReading] = createSignal(false);
  const [found, setFound] = createSignal<ImportedPlaceView[] | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const add = async (stop: NewStop, method: AddMethod, known: boolean) => {
    if (await props.onAdd(stop, method, known)) props.onClose();
  };

  const readLink = async (event: Event) => {
    event.preventDefault();
    const value = url().trim();
    if (!value || reading()) return;
    setReading(true);
    setError(null);
    setFound(null);
    try {
      const view = await importPlacesFromLink({ url: value, cityHint: props.cityName });
      setFound(view.places);
    } catch (err) {
      setError(importErrorMessage(err));
    } finally {
      setReading(false);
    }
  };

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <section class="space-y-2" aria-label={`Add a place to ${props.dayLabel}`}>
      <div class="flex items-center justify-between gap-2">
        <div class="flex gap-1" role="tablist" aria-label="How to add a place">
          <button
            type="button"
            role="tab"
            aria-selected={tab() === "search"}
            class={tabClass(tab() === "search")}
            onClick={() => setTab("search")}
          >
            <Search class="h-3.5 w-3.5" />
            Search
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab() === "link"}
            class={tabClass(tab() === "link")}
            onClick={() => setTab("link")}
          >
            <Link2 class="h-3.5 w-3.5" />
            Paste a link
          </button>
        </div>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
          onClick={() => props.onClose()}
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <Show when={tab() === "search"}>
        <PlacePicker
          cityName={props.cityName}
          label={`Add to ${props.dayLabel}`}
          busy={props.busy}
          onSelect={(poi) =>
            void add({ name: poi.name, poiId: poi.id || undefined }, "search", true)
          }
          onAddUnknown={(name) => void add({ name }, "named", false)}
        />
      </Show>

      <Show when={tab() === "link"}>
        <div class="rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm">
          <p class="text-sm font-semibold text-foreground">Add to {props.dayLabel}</p>
          <p class="mb-2 text-xs text-muted-foreground">
            A Google Maps link to a place, or a page or video that mentions some.
          </p>
          <form class="flex gap-2" onSubmit={readLink}>
            <label class="min-w-0 flex-1">
              <span class="sr-only">Link</span>
              <input
                type="url"
                inputmode="url"
                class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                value={url()}
                onInput={(e) => setUrl(e.currentTarget.value)}
                placeholder="https://maps.app.goo.gl/…"
                autocomplete="off"
              />
            </label>
            <button
              type="submit"
              class="h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              disabled={!url().trim() || reading() || props.busy}
            >
              {reading() ? "Reading…" : "Read link"}
            </button>
          </form>

          <Show when={error()}>
            <p class="mt-2 text-sm text-destructive" role="alert">
              {error()}
            </p>
          </Show>
          <Show when={found() && found()!.length === 0}>
            <p class="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              No places found in that link.
            </p>
          </Show>
          <Show when={(found()?.length ?? 0) > 0}>
            <ul class="mt-3 divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
              <For each={found()}>
                {(place) => (
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-start gap-3 bg-background/70 px-3 py-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50"
                      disabled={props.busy}
                      onClick={() =>
                        void add(stopFromImported(place), "link", Boolean(place.poiId))
                      }
                    >
                      <MapPin class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm font-medium text-foreground">
                          {place.poiName || place.name}
                        </span>
                        <span class="block truncate text-xs text-muted-foreground">
                          {[
                            place.category,
                            place.address || place.city,
                            place.poiId ? undefined : "New to Loci",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span class="text-xs font-medium text-primary">Add</span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </Show>
    </section>
  );
}
