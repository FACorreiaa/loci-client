import { For, Show, type JSX } from "solid-js";
import { A } from "@solidjs/router";
import { CalendarDays, MapPin } from "lucide-solid";
import TripGlobe from "~/components/features/Globe/TripGlobe";
import UserAvatar from "~/components/social/UserAvatar";
import { profilePath } from "~/lib/api/social";
import type { Trip } from "~/lib/api/trips";
import { formatDuration, formatTripDates, minutesToHHMM, summariseDay } from "~/lib/trip-format";
import { colorForMapDay } from "~/lib/theme-colors";
import { visibilityLabel } from "~/lib/social/visibility";

/**
 * Someone else's trip, read-only: who made it, the route on the globe, and
 * each day as a card. `actions` is the page's call to action (copy, open).
 */
export default function SharedTripView(props: { trip: Trip; actions?: JSX.Element }) {
  const dayCount = () => props.trip.days.length;
  const dates = () => formatTripDates(props.trip.days);
  const owner = () => props.trip.owner;
  const hasRoute = () => props.trip.days.some((d) => d.cityLat != null || d.stops.length > 0);

  return (
    <article>
      <section class="loci-hero mb-4">
        <div class="loci-hero__content p-6 sm:p-9">
          <p class="font-coord mb-3 text-[10px] uppercase tracking-[0.2em] text-primary-foreground/65">
            Shared route · {dayCount()} day{dayCount() === 1 ? "" : "s"}
          </p>
          <h1 class="max-w-3xl text-3xl text-primary-foreground sm:text-4xl">{props.trip.title}</h1>
          <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-primary-foreground/75">
            <Show when={props.trip.cityName}>
              <span class="inline-flex items-center gap-1.5">
                <MapPin class="h-4 w-4" aria-hidden="true" />
                {props.trip.cityName}
              </span>
            </Show>
            <Show when={dates()}>
              <span class="font-coord inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em]">
                <CalendarDays class="h-3.5 w-3.5" aria-hidden="true" />
                {dates()}
              </span>
            </Show>
          </div>
        </div>
      </section>

      <div class="mb-8 flex flex-wrap items-center gap-3">
        <Show when={owner()}>
          {(o) => (
            <Show
              when={profilePath(o())}
              fallback={
                <span class="inline-flex items-center gap-2 text-sm">
                  <UserAvatar user={o()} size="sm" />
                  {o().displayName}
                </span>
              }
            >
              {(href) => (
                <A href={href()} class="inline-flex items-center gap-2 text-sm hover:underline">
                  <UserAvatar user={o()} size="sm" />
                  <span>
                    <span class="font-medium">{o().displayName}</span>
                    <span class="text-muted-foreground"> @{o().username}</span>
                  </span>
                </A>
              )}
            </Show>
          )}
        </Show>
        <span class="font-coord text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {visibilityLabel(props.trip.visibility)}
        </span>
        <div class="flex flex-wrap items-center gap-2 sm:ml-auto">{props.actions}</div>
      </div>

      <Show when={hasRoute()}>
        <section aria-label="Route" class="mb-8">
          <TripGlobe trips={[props.trip]} class="h-[320px]" />
        </section>
      </Show>

      <For each={props.trip.days}>
        {(day) => {
          const summary = summariseDay(day);
          return (
            <section class="loci-card mb-6">
              <header class="rounded-t-2xl border-b border-border px-4 py-3">
                <h2 class="flex items-center gap-2 text-lg font-medium">
                  <span
                    class="h-2.5 w-2.5 rounded-full"
                    style={{ "background-color": colorForMapDay(day.dayNumber) }}
                    aria-hidden="true"
                  />
                  Day {day.dayNumber}
                  <Show when={day.cityName && day.cityName !== props.trip.cityName}>
                    <span class="text-sm font-normal text-muted-foreground">· {day.cityName}</span>
                  </Show>
                </h2>
                <p class="font-coord mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {summary.stopCount} stop{summary.stopCount === 1 ? "" : "s"}
                  <Show when={summary.window}>{(w) => <> · {w()}</>}</Show>
                </p>
              </header>
              <ol class="divide-y divide-border px-4">
                <For each={day.stops}>
                  {(stop, i) => (
                    <li class="flex gap-3 py-3">
                      <span class="font-coord w-6 shrink-0 pt-0.5 text-xs text-muted-foreground">
                        {i() + 1}
                      </span>
                      <div class="min-w-0 flex-1">
                        <p class="font-medium">{stop.name}</p>
                        <Show when={stop.notes}>
                          <p class="mt-0.5 text-sm text-muted-foreground">{stop.notes}</p>
                        </Show>
                      </div>
                      <Show when={stop.startMinute != null || stop.durationMinutes}>
                        <span class="font-coord shrink-0 text-right text-xs text-muted-foreground">
                          <Show when={stop.startMinute != null}>
                            <span class="block">{minutesToHHMM(stop.startMinute)}</span>
                          </Show>
                          <Show when={stop.durationMinutes}>
                            <span class="block">{formatDuration(stop.durationMinutes)}</span>
                          </Show>
                        </span>
                      </Show>
                    </li>
                  )}
                </For>
              </ol>
            </section>
          );
        }}
      </For>
    </article>
  );
}
