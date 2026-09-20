import { createSignal, For, Show } from "solid-js";
import { Compass, MapPin, Search } from "lucide-solid";
import { searchPOIs } from "~/lib/api/pois";
import type { POI } from "~/lib/api/types";
import { useUserLocation } from "~/contexts/LocationContext";
import { Button } from "~/ui/button";

/**
 * The way off the knowledge-gap queue.
 *
 * Contribute used to only list places the server already thinks are stale, so
 * a scout who knew a different café had to scroll a long list and still had
 * nowhere to say so. This card stays above that list.
 */
export function MissingPlaceCard(props: {
  activePoiId?: string;
  locked?: boolean;
  /** One-line search, used while a report is already open beside it. */
  compact?: boolean;
  onSelect: (poi: POI) => void;
}) {
  const location = useUserLocation();
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
      const here = location.userLocation();
      setResults(
        (
          await searchPOIs(value, {
            latitude: here?.latitude,
            longitude: here?.longitude,
            radiusKm: here ? 25 : undefined,
            searchType: here ? "hybrid" : "semantic",
          })
        ).slice(0, 5),
      );
    } catch {
      setResults([]);
      setError("We couldn't search places. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const searchForm = () => (
    <form class="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
      <label class="relative min-w-0 flex-1">
        <span class="sr-only">Search for a place we don&apos;t have on the list</span>
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          class="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          placeholder="Café, lookout, market…"
          autocomplete="off"
        />
      </label>
      <Button type="submit" class="h-11 shrink-0" disabled={!query().trim() || searching()}>
        {searching() ? "Searching…" : "Look up"}
      </Button>
    </form>
  );

  const resultsBlock = () => (
    <>
      <Show when={error()}>
        <p class="mt-3 text-sm text-destructive" role="alert">
          {error()}
        </p>
      </Show>

      <Show when={searched() && !searching() && !error() && results().length === 0}>
        <p class="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
          Not in the catalog under that name. Try a landmark, a neighbourhood, or a more specific
          spelling — field reports need a catalogued place.
        </p>
      </Show>

      <Show when={results().length > 0}>
        <ul class="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          <For each={results()}>
            {(poi) => (
              <li>
                <button
                  type="button"
                  class="flex min-h-11 w-full items-start gap-3 bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  aria-pressed={props.activePoiId === poi.id}
                  onClick={() => props.onSelect(poi)}
                >
                  <MapPin class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold text-foreground">
                      {poi.name}
                    </span>
                    <span class="block truncate text-xs text-muted-foreground">
                      {[poi.category, poi.address || poi.city].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span class="text-xs font-semibold text-accent">
                    {props.activePoiId === poi.id ? "Reporting" : "Report"}
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </>
  );

  return (
    <section
      class={`loci-card scroll-mt-24 border-dashed bg-secondary/40 ${props.compact ? "p-4" : "p-5 sm:p-6"}`}
      aria-labelledby="missing-place-heading"
    >
      <Show
        when={!props.compact}
        fallback={
          <div class="mb-3 flex items-center gap-2">
            <Compass class="h-4 w-4 text-accent" aria-hidden="true" />
            <h2 id="missing-place-heading" class="text-sm font-semibold">
              Something we&apos;re missing
            </h2>
          </div>
        }
      >
        <div class="flex items-start gap-3">
          <div class="rounded-xl border border-border bg-secondary p-2.5 text-accent">
            <Compass class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="kicker">Not on the list</p>
            <h2 id="missing-place-heading" class="mt-1.5 text-xl sm:text-2xl">
              Something we&apos;re missing
            </h2>
            <p class="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              A place you know that isn&apos;t in the knowledge-gap list. Search the catalog and
              file what you observed.
            </p>
          </div>
        </div>
      </Show>

      <Show when={props.locked}>
        <p class="mt-4 text-sm text-muted-foreground">
          Sign in to look a place up and file what you observed.
        </p>
      </Show>

      <Show when={!props.locked}>
        <div class={props.compact ? "" : "mt-4"}>
          {searchForm()}
          {resultsBlock()}
        </div>
      </Show>
    </section>
  );
}
