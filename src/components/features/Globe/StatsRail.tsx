import { createMemo, For, Show } from "solid-js";
import { TrendingDown, TrendingUp } from "lucide-solid";
import { trendPercent, type TravelSummary } from "~/lib/api/travel-history";

interface StatsRailProps {
  summary?: TravelSummary;
  loading?: boolean;
}

interface Stat {
  label: string;
  value: string;
  trend: number | null;
  /** Shown under the value when there is nothing to count yet. */
  hint?: string;
}

const nf = new Intl.NumberFormat();

/**
 * Main statistics rail.
 *
 * Every figure here is a count of real rows in user_visited_cities. The trend
 * arrows come from the summary's *_prev_period fields, which exist for exactly
 * this reason — a delta with no prior period returns null and renders no arrow,
 * rather than a decorative 0% or +100%.
 */
export default function StatsRail(props: StatsRailProps) {
  const stats = createMemo<Stat[]>(() => {
    const s = props.summary;
    if (!s) return [];
    return [
      {
        label: "Cities visited",
        value: nf.format(s.citiesVisited),
        trend: trendPercent(s.citiesVisited, s.citiesVisitedPrev),
      },
      {
        label: "Countries",
        value: nf.format(s.countriesVisited),
        trend: trendPercent(s.countriesVisited, s.countriesVisitedPrev),
        // Country is only known where a city resolved against the cities table;
        // it is never inferred from coordinates.
        hint:
          s.citiesVisited > 0 && s.countriesVisited === 0
            ? "No country recorded for your cities yet"
            : undefined,
      },
      {
        label: "Places",
        value: nf.format(s.poisVisited),
        trend: trendPercent(s.poisVisited, s.poisVisitedPrev),
      },
      {
        label: "Distance travelled",
        value: `${nf.format(Math.round(s.distanceKm))} km`,
        trend: null,
      },
    ];
  });

  return (
    <section aria-labelledby="globe-stats-heading" class="flex flex-col gap-6">
      <h2 id="globe-stats-heading" class="font-serif text-3xl leading-tight">
        Main
        <br />
        Statistics
      </h2>

      <Show
        when={!props.loading}
        fallback={
          <div class="flex flex-col gap-6" aria-busy="true">
            <For each={[0, 1, 2, 3]}>
              {() => (
                <div class="flex flex-col gap-2">
                  <div class="h-3 w-24 animate-pulse rounded bg-primary/10" />
                  <div class="h-8 w-20 animate-pulse rounded bg-primary/10" />
                </div>
              )}
            </For>
          </div>
        }
      >
        <dl class="flex flex-col gap-6">
          <For each={stats()}>
            {(stat) => (
              <div>
                <dt class="ui-label text-xs text-muted-foreground">{stat.label}</dt>
                <dd class="mt-1 flex items-baseline gap-2">
                  <span class="font-serif text-3xl tabular-nums">{stat.value}</span>
                  <Show when={stat.trend !== null}>
                    <span
                      class={`inline-flex items-center gap-0.5 text-xs tabular-nums ${
                        stat.trend! >= 0 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      <Show
                        when={stat.trend! >= 0}
                        fallback={<TrendingDown class="h-3 w-3" aria-hidden="true" />}
                      >
                        <TrendingUp class="h-3 w-3" aria-hidden="true" />
                      </Show>
                      {stat.trend! >= 0 ? "+" : ""}
                      {Math.round(stat.trend!)}%
                      <span class="sr-only">compared with the previous period</span>
                    </span>
                  </Show>
                </dd>
                <Show when={stat.hint}>
                  <p class="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
                </Show>
              </div>
            )}
          </For>
        </dl>
      </Show>
    </section>
  );
}
