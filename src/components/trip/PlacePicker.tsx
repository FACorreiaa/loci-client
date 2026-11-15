import { createSignal, For, Show } from "solid-js";
import { MapPin, Search } from "lucide-solid";
import { searchPOIs } from "~/lib/api/pois";
import type { POI } from "~/lib/api/types";

interface PlacePickerProps {
  cityName?: string;
  label: string;
  busy?: boolean;
  onSelect: (poi: POI) => void;
  onCancel?: () => void;
  /**
   * When set, a finished search also offers to add what was typed as a stop
   * with just that name: the place Loci does not know yet.
   */
  onAddUnknown?: (name: string) => void;
}

export default function PlacePicker(props: PlacePickerProps) {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<POI[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [searched, setSearched] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const submit = async (event: Event) => {
    event.preventDefault();
    const value = query().trim();
    if (!value || searching()) return;
    setSearching(true);
    setSearched(true);
    setError(null);
    try {
      setResults((await searchPOIs(value, { cityName: props.cityName })).slice(0, 6));
    } catch {
      setResults([]);
      setError("We couldn't search places. Try again.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div class="rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm">
      <div class="mb-2 flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-foreground">{props.label}</p>
          <Show when={props.cityName}>
            <p class="text-xs text-muted-foreground">Search canonical places in {props.cityName}</p>
          </Show>
        </div>
        <Show when={props.onCancel}>
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => props.onCancel?.()}
          >
            Cancel
          </button>
        </Show>
      </div>

      <form class="flex gap-2" onSubmit={submit}>
        <label class="relative min-w-0 flex-1">
          <span class="sr-only">Search for a place</span>
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            class="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="Museum, market, viewpoint…"
            autocomplete="off"
          />
        </label>
        <button
          type="submit"
          class="h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-transform hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          disabled={!query().trim() || searching() || props.busy}
        >
          {searching() ? "Searching…" : "Search"}
        </button>
      </form>

      <Show when={error()}>
        <p class="mt-2 text-sm text-destructive" role="alert">
          {error()}
        </p>
      </Show>
      <Show when={searched() && !searching() && !error() && results().length === 0}>
        <p class="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          No matching places yet. Try a landmark name or broader category.
        </p>
      </Show>
      <Show when={results().length > 0}>
        <ul class="mt-3 divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
          <For each={results()}>
            {(poi) => (
              <li>
                <button
                  type="button"
                  class="flex w-full items-start gap-3 bg-background/70 px-3 py-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50"
                  disabled={props.busy}
                  onClick={() => props.onSelect(poi)}
                >
                  <MapPin class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-foreground">
                      {poi.name}
                    </span>
                    <span class="block truncate text-xs text-muted-foreground">
                      {[poi.category, poi.address || poi.city].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span class="text-xs font-medium text-primary">Choose</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.onAddUnknown && searched() && !searching() && query().trim()}>
        <button
          type="button"
          class="mt-2 w-full rounded-lg border border-dashed border-border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          disabled={props.busy}
          onClick={() => props.onAddUnknown?.(query().trim())}
        >
          Not listed? Add <span class="font-medium text-foreground">“{query().trim()}”</span> as a
          stop by name
        </button>
      </Show>
    </div>
  );
}
