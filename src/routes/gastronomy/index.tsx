import { createMemo, For, Match, Switch } from "solid-js";
import { Meta, Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { UtensilsCrossed } from "lucide-solid";
import GastronomySection from "~/components/gastronomy/GastronomySection";
import { CityAutocomplete } from "~/components/compare/CityAutocomplete";
import ErrorView from "~/components/ErrorView";
import StopCardSkeleton from "~/components/itinerary/StopCardSkeleton";
import { hasGastronomy, useCityGastronomy } from "~/lib/api/gastronomy";
import type { CityGastronomy } from "~/lib/api/types";
import { useLiveSession } from "~/lib/streaming/live-stream-store";

const SUGGESTED_CITIES = ["Lisbon", "Porto", "Madeira", "Naples", "Mexico City", "Tokyo"];

/**
 * Typical gastronomy of a city: overview, dishes and famous places to eat
 * them, filterable by dish type and by ingredient or diet.
 *
 * Reached two ways. A chat search like "food in Madeira" lands here with its
 * sessionId, and the section renders straight from the live stream. Otherwise
 * the page asks GetCityGastronomy for ?cityName — which the server answers
 * from its city-scoped cache after the first request for that city.
 */
export default function GastronomyPage() {
  const [params, setParams] = useSearchParams<{ cityName?: string; sessionId?: string }>();
  const city = () => params.cityName?.trim() || undefined;

  const live = useLiveSession(() => params.sessionId);
  const streamed = createMemo<CityGastronomy | undefined>(() => {
    const g = (live.data() as { gastronomy?: CityGastronomy } | null)?.gastronomy;
    return hasGastronomy(g) ? g : undefined;
  });
  // While the stream that brought us here is still producing, it will deliver
  // the answer; asking the server again would only pay for it twice.
  const waitingOnStream = () => live.isStreaming() && !streamed();

  const query = useCityGastronomy(city, () => !streamed() && !live.isStreaming());
  // Reading `.data` on a pending query suspends the whole app; check first.
  const fetched = () => (query.isPending ? undefined : query.data);
  const gastronomy = () => streamed() ?? fetched();

  const pickCity = (name: string) => setParams({ cityName: name, sessionId: undefined });

  return (
    <>
      <Title>{city() ? `Food of ${city()} · Loci` : "Typical gastronomy · Loci"}</Title>
      <Meta
        name="description"
        content="Discover a city's typical dishes and the famous places to eat them."
      />

      <div class="max-w-6xl mx-auto px-4 py-8 pb-24 space-y-8">
        <header class="space-y-4">
          <div class="flex items-center gap-2 text-primary">
            <UtensilsCrossed class="h-5 w-5" aria-hidden="true" />
            <p class="kicker">Typical gastronomy</p>
          </div>
          <h1 class="editorial-title text-3xl sm:text-4xl text-foreground">
            What do people eat here?
          </h1>
          <p class="editorial-lead text-muted-foreground max-w-2xl">
            Pick a city to see its signature dishes and the well-known places to try them.
          </p>
          <div class="max-w-md">
            <CityAutocomplete
              label="City"
              placeholder="Search a city"
              value={city() ? { name: city()! } : null}
              onSelect={(c) => pickCity(c.name)}
            />
          </div>
        </header>

        <Switch>
          <Match when={gastronomy()}>{(g) => <GastronomySection gastronomy={g()} />}</Match>
          <Match when={waitingOnStream() || (city() && query.isFetching)}>
            <div class="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading dishes">
              <For each={[0, 1, 2, 3]}>{() => <StopCardSkeleton />}</For>
            </div>
          </Match>
          <Match when={live.error() && !query.isError}>
            <ErrorView error={new Error(live.error() ?? "")} onRetry={() => query.refetch()} />
          </Match>
          <Match when={city() && query.isError}>
            <ErrorView error={query.error} onRetry={() => query.refetch()} />
          </Match>
          <Match when={!city()}>
            <div class="loci-card p-6 space-y-3">
              <p class="text-sm text-muted-foreground">Or start with one of these:</p>
              <div class="flex flex-wrap gap-2">
                <For each={SUGGESTED_CITIES}>
                  {(name) => (
                    <button
                      type="button"
                      class="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => pickCity(name)}
                    >
                      {name}
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Match>
        </Switch>
      </div>
    </>
  );
}
