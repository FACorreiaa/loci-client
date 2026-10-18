import { Show, type JSX } from "solid-js";
import { Badge } from "~/ui/badge";
import { summariseDay } from "~/lib/trip-format";
import type { TripDay } from "~/lib/api/trips";

export interface TripDaySectionProps {
  day: TripDay;
  /** The trip's primary city, so a day only names its city when it differs. */
  tripCityName: string;
  dotColor: string;
  /** The stop rows. */
  children: JSX.Element;
  /** The add-a-stop control, hidden outside edit mode. */
  addSlot?: JSX.Element;
}

/**
 * One day of the trip. The header sticks under the nav while you scroll its
 * stops, so you always know which day you are looking at, and carries a
 * one-line summary — how many stops, the window they cover, how much of the
 * day they actually fill.
 */
export default function TripDaySection(props: TripDaySectionProps) {
  const summary = () => summariseDay(props.day);
  const showCity = () => props.day.cityName && props.day.cityName !== props.tripCityName;

  return (
    <section class="loci-card mb-6">
      {/* Sticky rather than overflow-clipped: an `overflow-hidden` ancestor
          would become the scrollport and silently defeat this. If the app
          shell ever clips, the header just renders in flow — no visual harm. */}
      <header class="sticky top-16 z-10 rounded-t-2xl border-b border-border bg-card px-4 py-3">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 class="flex items-center gap-2 text-lg font-medium">
            <span
              class="h-2.5 w-2.5 rounded-full"
              style={{ "background-color": props.dotColor }}
              aria-hidden="true"
            />
            Day {props.day.dayNumber}
          </h2>
          <Show when={showCity()}>
            <span class="text-sm text-accent">{props.day.cityName}</span>
          </Show>
          <Show when={props.day.date}>
            <span class="text-sm text-muted-foreground">
              {new Date(props.day.date!).toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
          </Show>
          <Show when={props.day.travelDay}>
            <Badge variant="outline" class="font-coord text-[10px] uppercase tracking-[0.12em]">
              Travel day
            </Badge>
          </Show>
        </div>

        <p class="font-coord mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {summary().stopCount} stop{summary().stopCount === 1 ? "" : "s"}
          <Show when={summary().window}>{(w) => <> · {w()}</>}</Show>
          <Show when={summary().totalLabel}>{(t) => <> · {t()} planned</>}</Show>
        </p>
      </header>

      <div class="px-4 pb-4 pt-4">
        <ol>{props.children}</ol>
        <Show when={props.addSlot}>
          <div class="no-print mt-3 pl-[2.75rem] sm:pl-[3.75rem]">{props.addSlot}</div>
        </Show>
      </div>
    </section>
  );
}
