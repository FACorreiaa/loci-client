// What the traveller has kept: saved places and the routes not already on the band.
import { createMemo, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import type { Trip } from "~/lib/api/trips";
import { contentTypeLabel, recentFavorites, type KeptFavorite } from "~/lib/dashboard/kept";
import { otherTrips, tripDateRange } from "~/lib/dashboard/next-trip";
import { plural } from "~/lib/dashboard/format";
import SectionHeader from "~/components/ui/SectionHeader";

interface Props {
  favorites: KeptFavorite[] | undefined;
  trips: Trip[];
  excludeTripId?: string;
  /** Both queries have answered. Nothing renders before, so the empty note cannot flash. */
  settled: boolean;
}

const rowMeta = "font-coord shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground";
const listAction = "text-sm font-medium text-muted-foreground hover:text-foreground";

export default function KeptSection(props: Props) {
  const saved = createMemo(() => recentFavorites(props.favorites));
  const routes = createMemo(() => otherTrips(props.trips, props.excludeTripId));
  const empty = () => saved().length === 0 && routes().length === 0;

  return (
    <Show when={props.settled}>
      <Show
        when={!empty()}
        fallback={
          <div class="mb-10 rounded-xl border border-dashed border-border bg-card/70 px-5 py-10">
            <p class="font-display text-lg text-foreground">Nothing logged yet</p>
            <p class="mt-2 max-w-md text-sm text-muted-foreground">
              Start with a city, a mood, or one stop you refuse to miss.
            </p>
            <A href="/discover" class="mt-4 inline-block text-sm font-medium text-primary">
              Open Discover
            </A>
          </div>
        }
      >
        <div class="mb-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <Show when={saved().length > 0}>
            <section aria-label="Saved places">
              <SectionHeader
                size="sm"
                kicker="kept"
                title="Saved places"
                action={
                  <A href="/saved?view=places" class={listAction}>
                    All saved
                  </A>
                }
              />
              <ul class="divide-y divide-border border-t border-border">
                <For each={saved()}>
                  {(f) => (
                    <li class="flex items-baseline justify-between gap-4 py-3">
                      <div class="min-w-0">
                        <p class="truncate text-sm font-medium text-foreground">{f.itemName}</p>
                        <Show when={f.cityName}>
                          <p class="mt-0.5 text-xs text-muted-foreground">{f.cityName}</p>
                        </Show>
                      </div>
                      <span class={rowMeta}>{contentTypeLabel(f.contentType)}</span>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>

          <Show when={routes().length > 0}>
            <section aria-label="Other routes">
              <SectionHeader
                size="sm"
                kicker="kept"
                title="Other routes"
                action={
                  <A href="/trips" class={listAction}>
                    All routes
                  </A>
                }
              />
              <ul class="divide-y divide-border border-t border-border">
                <For each={routes()}>
                  {(t) => (
                    <li>
                      <A
                        href={`/trips/${t.id}`}
                        class="flex items-baseline justify-between gap-4 py-3 transition-colors hover:text-primary"
                      >
                        <div class="min-w-0">
                          <p class="truncate text-sm font-medium text-foreground">
                            {t.title || t.cityName}
                          </p>
                          <Show when={t.title && t.cityName}>
                            <p class="mt-0.5 text-xs text-muted-foreground">{t.cityName}</p>
                          </Show>
                        </div>
                        <span class={rowMeta}>
                          {tripDateRange(t) ?? plural(t.days.length, "day")}
                        </span>
                      </A>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>
        </div>
      </Show>
    </Show>
  );
}
