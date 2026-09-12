import { For, Show, createEffect, createMemo, createSignal, on } from "solid-js";
import { Sparkles, Check, AlertTriangle } from "lucide-solid";
import StopCard from "./StopCard";
import StopCardSkeleton from "./StopCardSkeleton";
import type { ItineraryStop, StreamPhase } from "@/lib/itinerary/createItineraryStream";
import { groupStopsByDay } from "@/lib/trip-kit";
import { INITIAL_DAYS, windowDays } from "@/lib/itinerary/day-paging";
import "@/styles/editorial.css";

/**
 * Orchestrates the three phases visually:
 *   skeleton  → header + N shimmer cards (instant, <500ms)
 *   enriching → real cards; images/ratings pop in per stop; status rail
 *   done      → rail collapses to a quiet "ready" confirmation
 *
 * All reactivity is fine-grained: enrichment patches a single StopCard,
 * the <For> list is never rebuilt.
 */
// Mirror of the map's day palette so list day-dots match marker colours.
const DAY_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export interface ItineraryStreamViewProps {
  phase: StreamPhase;
  title: string;
  summary: string;
  stops: ItineraryStop[];
  enrichedCount: number;
  /** how many shimmer rows to show before any skeleton arrives */
  skeletonCount?: number;
  error?: string;
  onRetry?: () => void;
  onBack?: () => void;
  onStopClick?: (stop: ItineraryStop) => void;
  /** When set, stops are grouped into days of this size with day headers. */
  stopsPerDay?: number;
  /** Currently selected stop name (synced with the map). */
  selectedKey?: string;
}

export default function ItineraryStreamView(props: ItineraryStreamViewProps) {
  const total = () => props.stops.length;
  const hasStops = () => total() > 0;
  const progress = createMemo(() =>
    total() === 0 ? 0 : Math.round((props.enrichedCount / total()) * 100),
  );
  const everythingEnriched = () => hasStops() && props.enrichedCount >= total();

  // The server says which day a stop belongs to; only when it has not does
  // this fall back to chunking by index. Deriving days from the number of
  // stops was the old behaviour and it had the dependency backwards — a
  // four-day trip with twenty-four places rendered as six days.
  //
  // groupStopsByDay is the one grouping implementation in the client, shared
  // with the trip kit, so a day here and a day in an export cannot disagree.
  const dayGroups = createMemo(() => {
    const per = props.stopsPerDay ?? 0;
    const hasDays = props.stops.some((stop) => typeof stop.day === "number");

    if (per <= 0 && !hasDays) {
      return [
        { day: 0, label: "Day 1", items: props.stops.map((stop, index) => ({ stop, index })) },
      ];
    }

    // Numbering accumulates across groups rather than being looked up by
    // identity: the chunking branch of groupStopsByDay spreads each stop into
    // a new object to stamp its day, so identity does not survive it.
    let index = 0;
    return groupStopsByDay(props.stops, per > 0 ? per : undefined).map((group) => ({
      day: group.day,
      // The heading comes from the grouper rather than being recomputed here:
      // the server numbers days from 1, so `day + 1` showed a four-day trip as
      // "Day 2" through "Day 5". One place decides what a day is called.
      label: group.label,
      items: group.stops.map((stop) => ({ stop, index: index++ })),
    }));
  });

  const grouped = () =>
    props.stops.some((stop) => typeof stop.day === "number") ||
    ((props.stopsPerDay ?? 0) > 0 && total() > props.stopsPerDay!);

  // How many days are on screen. Starts at INITIAL_DAYS so a long trip does
  // not bury its first day under its last, and opens fully on request.
  const [visibleDays, setVisibleDays] = createSignal(INITIAL_DAYS);

  // A new search must not inherit the previous trip's expanded state. Keyed on
  // the stop count rather than the array: enrichment patches rows in place and
  // deliberately keeps the array reference, so watching the array itself would
  // never fire, while watching its length fires exactly when the trip changes.
  createEffect(
    on(
      () => props.stops.length,
      () => setVisibleDays(INITIAL_DAYS),
      { defer: true },
    ),
  );

  const dayWindow = createMemo(() => windowDays(dayGroups(), visibleDays()));

  return (
    <div class="space-y-4">
      {/* ---- Editorial header -------------------------------- */}
      <header>
        <p class="kicker mb-2">Your itinerary</p>
        <Show when={props.title} fallback={<div class="shimmer h-9 w-3/4 rounded-lg mb-2" />}>
          <h1 class="editorial-title text-2xl sm:text-3xl text-foreground">{props.title}</h1>
        </Show>
        <Show
          when={props.summary}
          fallback={
            <div class="space-y-2 mt-3">
              <div class="shimmer h-3 w-full rounded-full" />
              <div class="shimmer h-3 w-5/6 rounded-full" />
            </div>
          }
        >
          <p class="editorial-lead mt-2 max-w-prose">{props.summary}</p>
        </Show>
      </header>

      {/* ---- Status rail ------------------------------------- */}
      <Show when={props.phase !== "done" && props.phase !== "error"}>
        <div class="flex items-center gap-3">
          <div
            class="flex-1 stream-rail"
            classList={{ "stream-rail-indeterminate": props.enrichedCount === 0 }}
          >
            <div class="stream-rail-fill" style={{ width: `${progress()}%` }} />
          </div>
          <span class="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5 shrink-0">
            <Sparkles class="w-3.5 h-3.5 text-accent animate-pulse" />
            <Show when={hasStops()} fallback="Sketching your days…">
              {everythingEnriched()
                ? "Finishing up…"
                : `Adding photos ${props.enrichedCount}/${total()}`}
            </Show>
          </span>
        </div>
      </Show>

      <Show when={props.phase === "done"}>
        <p class="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
          <Check class="w-3.5 h-3.5 text-accent" /> Itinerary ready · {total()} stops
        </p>
      </Show>

      <Show when={props.phase === "error"}>
        <div class="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive space-y-3">
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0" />
            <p class="text-sm">{props.error || "Something went wrong building your itinerary."}</p>
          </div>
          <Show when={props.onRetry || props.onBack}>
            <div class="flex flex-wrap gap-2 pl-6">
              <Show when={props.onRetry}>
                <button
                  type="button"
                  class="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => props.onRetry?.()}
                >
                  Retry
                </button>
              </Show>
              <Show when={props.onBack}>
                <button
                  type="button"
                  class="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium hover:bg-destructive/5"
                  onClick={() => props.onBack?.()}
                >
                  Back to discover
                </button>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      {/* ---- Stops ------------------------------------------- */}
      <div class="space-y-3">
        <Show
          when={hasStops()}
          fallback={
            <Show when={props.phase !== "error"}>
              <For each={Array(props.skeletonCount ?? 5).fill(0)}>
                {(_, i) => <StopCardSkeleton index={i()} />}
              </For>
            </Show>
          }
        >
          <Show
            when={grouped()}
            fallback={
              <For each={props.stops}>
                {(stop, i) => (
                  <StopCard
                    stop={stop}
                    index={i()}
                    onClick={props.onStopClick}
                    selected={props.selectedKey === stop.name}
                  />
                )}
              </For>
            }
          >
            <For each={dayWindow().visible}>
              {(group) => (
                <div class="space-y-3">
                  <div class="flex items-center gap-2 pt-2">
                    <span
                      class="w-3 h-3 rounded-full shrink-0"
                      style={{ "background-color": DAY_COLORS[group.day % DAY_COLORS.length] }}
                    />
                    <p class="kicker">{group.label}</p>
                  </div>
                  <For each={group.items}>
                    {(item) => (
                      <StopCard
                        stop={item.stop}
                        index={item.index}
                        onClick={props.onStopClick}
                        selected={props.selectedKey === item.stop.name}
                      />
                    )}
                  </For>
                </div>
              )}
            </For>

            {/* Absent entirely for a trip that fits, so a short answer looks
                no different from how it always has. */}
            <Show when={dayWindow().remaining > 0}>
              <button
                type="button"
                class="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/40 hover:bg-muted/40 transition focus:outline-none focus:ring-2 focus:ring-ring"
                onClick={() => setVisibleDays(dayGroups().length)}
              >
                Show the rest of the trip
                <span class="ml-1 font-normal text-muted-foreground">
                  ({dayWindow().remaining} more {dayWindow().remaining === 1 ? "day" : "days"})
                </span>
              </button>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}
