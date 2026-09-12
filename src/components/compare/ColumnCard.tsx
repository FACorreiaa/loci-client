import { For, Show } from "solid-js";
import { Loader2, ArrowRight, Car } from "lucide-solid";
import type { CityCompareColumn } from "~/lib/api/compare";
import { recordRecommendationEvents } from "~/lib/api/recommendations";
import LocalWeather from "~/components/LocalWeather";
import { GoScoreCard } from "~/components/ui/GoScoreCard";
import WhyThisStop from "~/components/poi/WhyThisStop";

export function ColumnCard(props: {
  column: CityCompareColumn;
  onChoose: () => void;
  choosing: boolean;
}) {
  const col = () => props.column;
  return (
    <article class="loci-card rounded-2xl p-5 flex flex-col gap-4">
      <header>
        <p class="kicker mb-1">{col().country || "Portugal"}</p>
        <h2 class="font-display text-2xl text-foreground">{col().cityName}</h2>
        <p class="text-sm text-muted-foreground mt-1">
          {Math.round(col().distanceKm)} km · ~{col().travelMins} min drive
        </p>
      </header>

      {/* The verdict goes above the detail: the whole point of /compare is to
          answer "which one", so lead with the answer and let the weather, places
          and pros/cons below justify it. */}
      <Show when={col().goScore}>
        <GoScoreCard score={col().goScore!} />
      </Show>

      <Show when={col().centerLat && col().centerLon}>
        <LocalWeather latitude={col().centerLat} longitude={col().centerLon} days={2} />
      </Show>

      <div>
        <h3 class="text-sm font-semibold mb-2">Top places</h3>
        {/* A city the server has only just placed on the map has no places
            stored yet, and it is already generating them in the background.
            An empty list rendered nothing at all, which reads as broken rather
            than as new. */}
        <Show
          when={col().topPois.length > 0}
          fallback={
            <p class="text-sm text-muted-foreground">
              We’re still finding places in {col().cityName} — check back in a minute.
            </p>
          }
        >
          <ul class="space-y-2">
            <For each={col().topPois.slice(0, 5)}>
              {(poi) => (
                <li class="text-sm">
                  <span class="font-medium">{poi.name}</span>
                  <Show when={poi.category}>
                    <span class="text-muted-foreground"> · {poi.category}</span>
                  </Show>
                  <Show when={poi.descriptionPoi || poi.description}>
                    <WhyThisStop
                      reason={poi.descriptionPoi || poi.description || ""}
                      class="mt-1"
                    />
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>

      <div class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p class="font-semibold text-accent mb-1">Pros</p>
          <ul class="space-y-1 text-muted-foreground">
            <For each={col().pros}>{(p) => <li>{p}</li>}</For>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-destructive mb-1">Cons</p>
          <ul class="space-y-1 text-muted-foreground">
            <For each={col().cons}>{(c) => <li>{c}</li>}</For>
          </ul>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <For each={col().bookingOptions}>
          {(b) => (
            <a
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              class="loci-hero__action text-xs px-3 py-1.5"
              onClick={() =>
                recordRecommendationEvents([
                  {
                    eventType: "RECOMMENDATION_EVENT_TYPE_BOOKING_OPENED",
                    poiId: col().cityId,
                    trace: {
                      runId: "compare",
                      itemId: col().cityId,
                      rank: 0,
                      algorithmVersion: "compare-v2",
                      experimentVariant: "default",
                      surface: "RECOMMENDATION_SURFACE_DISCOVER",
                      channel: "RECOMMENDATION_CHANNEL_WEB",
                    },
                    metadata: { provider: b.provider, surface: "compare" },
                  },
                ])
              }
            >
              {b.label}
            </a>
          )}
        </For>
        <For each={col().transportOptions.filter((t: { url?: string }) => t.url)}>
          {(t) => (
            <a
              href={t.url!}
              target="_blank"
              rel="noopener noreferrer"
              class="loci-chip loci-chip--surface text-xs inline-flex items-center gap-1"
            >
              <Car class="w-3 h-3" />
              {t.summary}
            </a>
          )}
        </For>
      </div>

      <button
        type="button"
        class="loci-hero__action w-full justify-center mt-auto"
        disabled={props.choosing}
        onClick={props.onChoose}
      >
        {props.choosing ? (
          <Loader2 class="w-4 h-4 animate-spin" />
        ) : (
          <>
            Choose {col().cityName}
            <ArrowRight class="w-4 h-4" />
          </>
        )}
      </button>
    </article>
  );
}

export default ColumnCard;
