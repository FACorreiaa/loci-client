import { For, Show, createEffect, createMemo, createSignal, on, type JSX } from "solid-js";
import { Sparkles, Check, AlertTriangle } from "lucide-solid";
import StopCard from "./StopCard";
import StopCardSkeleton from "./StopCardSkeleton";
import type { ItineraryStop, StreamPhase } from "@/lib/itinerary/createItineraryStream";
import { groupStopsByDay } from "@/lib/trip-kit";
import { INITIAL_DAYS, windowDays } from "@/lib/itinerary/day-paging";
import { colorForMapDay } from "@/lib/theme-colors";
import { legBetween, type AccessibleRoute } from "@/lib/accessibility";
import { RouteDaySummary, WalkingLegRow } from "@/components/poi/AccessibilityNotes";
import type { ItineraryDayMeta } from "@/lib/itinerary/trip-view";
import { CheckSourceNote, DayVerdictLine } from "./CheckStamp";
import { tallyChecks } from "~/lib/stop-check";

/** Where a stop sits in its day, for a footer that offers to move it. */
export interface StopPlacement {
  isFirst: boolean;
  isLast: boolean;
  /** The trip day the stop is on; absent when the list is not a trip's. */
  day?: ItineraryDayMeta;
}

/**
 * Orchestrates the three phases visually:
 *   skeleton  → header + N shimmer cards (instant, <500ms)
 *   enriching → real cards; images/ratings pop in per stop; status rail
 *   done      → rail collapses to a quiet "ready" confirmation
 *
 * All reactivity is fine-grained: enrichment patches a single StopCard,
 * the <For> list is never rebuilt.
 *
 * Day dots take their colour from the same LOCI_DAY_COLORS the map draws its
 * markers with. This used to keep its own copy of an older palette, so the
 * dot next to "Day 2" and the Day 2 pins were two different colours.
 */

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
  /**
   * Walks between each day's stops, routed for the traveller's access needs.
   * Absent for everyone without needs, and the view is unchanged.
   */
  accessibleRoutes?: AccessibleRoute[];
  /**
   * The days of the trip this list is a view of. When set, the headings come
   * from here rather than from the stops, so a day with no stops left still
   * has a heading (and somewhere to add to), and `stop.day` is the position
   * of the stop's day in this list.
   */
  days?: ItineraryDayMeta[];
  /** Rendered under each stop's card: links and edit controls. */
  stopFooter?: (stop: ItineraryStop, placement: StopPlacement) => JSX.Element;
  /** Rendered under each trip day's heading: how the day starts. Needs `days`. */
  dayHeader?: (day: ItineraryDayMeta) => JSX.Element;
  /** Rendered at the end of each trip day: "add a place". Needs `days`. */
  dayFooter?: (day: ItineraryDayMeta) => JSX.Element;
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
    // A view of a trip: the trip says which days exist and in what order.
    if (props.days?.length) {
      let index = 0;
      return props.days.map((meta) => ({
        day: meta.day,
        label: meta.label,
        meta: meta as ItineraryDayMeta | undefined,
        items: props.stops
          .filter((stop) => stop.day === meta.day)
          .map((stop) => ({ stop, index: index++ })),
      }));
    }

    const per = props.stopsPerDay ?? 0;
    const hasDays = props.stops.some((stop) => typeof stop.day === "number");

    if (per <= 0 && !hasDays) {
      return [
        {
          day: 0,
          label: "Day 1",
          meta: undefined as ItineraryDayMeta | undefined,
          items: props.stops.map((stop, index) => ({ stop, index })),
        },
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
      meta: undefined as ItineraryDayMeta | undefined,
      items: group.stops.map((stop) => ({ stop, index: index++ })),
    }));
  });

  const grouped = () =>
    Boolean(props.days?.length) ||
    props.stops.some((stop) => typeof stop.day === "number") ||
    ((props.stopsPerDay ?? 0) > 0 && total() > props.stopsPerDay!);

  // How many days are on screen. Starts at INITIAL_DAYS so a long trip does
  // not bury its first day under its last, and opens fully on request.
  const [visibleDays, setVisibleDays] = createSignal(INITIAL_DAYS);

  // A new search must not inherit the previous trip's expanded state. Keyed on
  // the stop count rather than the array: enrichment patches rows in place and
  // deliberately keeps the array reference, so watching the array itself would
  // never fire, while watching its length fires exactly when the trip changes.
  //
  // A view of a trip is exempt: there the count changes because the traveller
  // added or removed a stop, and folding the trip back up under them, away
  // from the day they were editing, would be the opposite of what they asked.
  createEffect(
    on(
      () => (props.days?.length ? -1 : props.stops.length),
      (count) => {
        if (count >= 0) setVisibleDays(INITIAL_DAYS);
      },
      { defer: true },
    ),
  );

  const dayWindow = createMemo(() => windowDays(dayGroups(), visibleDays()));

  // Groups are 0-based days; the server numbers them from 1.
  const routeFor = (day: number) => props.accessibleRoutes?.find((r) => r.day === day + 1);

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
      <Show when={props.stops.some((s) => s.check)}>
        <CheckSourceNote class="mb-3" />
      </Show>
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
                  <>
                    <StopCard
                      stop={stop}
                      index={i()}
                      onClick={props.onStopClick}
                      selected={props.selectedKey === stop.name}
                    />
                    {props.stopFooter?.(stop, {
                      isFirst: i() === 0,
                      isLast: i() === props.stops.length - 1,
                    })}
                  </>
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
                      style={{ "background-color": colorForMapDay(group.day) }}
                    />
                    <p class="kicker">{group.label}</p>
                    <p class="font-coord text-[11px] uppercase tracking-[0.14em]">
                      <DayVerdictLine tally={tallyChecks(group.items.map((item) => item.stop))} />
                    </p>
                  </div>
                  <Show when={routeFor(group.day)}>
                    {(route) => <RouteDaySummary route={route()} />}
                  </Show>
                  <Show when={group.meta}>{(meta) => props.dayHeader?.(meta())}</Show>
                  <For each={group.items}>
                    {(item, i) => (
                      <>
                        <Show
                          when={legBetween(
                            routeFor(group.day),
                            group.items[i() - 1]?.stop.routeRef,
                            item.stop.routeRef,
                          )}
                        >
                          {(leg) => <WalkingLegRow leg={leg()} />}
                        </Show>
                        <StopCard
                          stop={item.stop}
                          index={item.index}
                          onClick={props.onStopClick}
                          selected={props.selectedKey === item.stop.name}
                        />
                        {props.stopFooter?.(item.stop, {
                          isFirst: i() === 0,
                          isLast: i() === group.items.length - 1,
                          day: group.meta,
                        })}
                      </>
                    )}
                  </For>
                  <Show when={group.meta}>{(meta) => props.dayFooter?.(meta())}</Show>
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
