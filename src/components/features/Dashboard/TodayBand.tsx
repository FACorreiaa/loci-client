// On a trip day the desk leads with the day itself: which day, the next stop,
// and the way back into the plan. The prompt box moves below it.
import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { ArrowRight, MapPin } from "lucide-solid";
import type { TripToday } from "~/lib/dashboard/today";
import { plural } from "~/lib/dashboard/format";
import { minutesToHHMM } from "~/lib/trip-format";

interface Props {
  today: TripToday;
}

export default function TodayBand(props: Props) {
  const city = () =>
    props.today.day.cityName || props.today.trip.cityName || props.today.trip.title;
  const stops = () => [...props.today.day.stops].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <section class="loci-card mb-6 p-5 sm:p-6" aria-label="Today on your trip">
      <p class="kicker mb-2">
        today · day {props.today.day.dayNumber} of {props.today.trip.days.length}
      </p>
      <h2 class="text-2xl text-foreground sm:text-3xl">{city()}</h2>

      <Show
        when={props.today.next}
        fallback={<p class="mt-3 text-sm text-muted-foreground">Nothing planned today yet.</p>}
      >
        {(next) => (
          <div class="mt-4 flex items-start gap-3">
            <MapPin class="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div class="min-w-0">
              <p class="text-sm text-muted-foreground">Next</p>
              <p class="text-base font-medium text-foreground">
                {next().name}
                <Show when={next().startMinute !== undefined}>
                  <span class="font-coord text-sm text-muted-foreground">
                    {" "}
                    · {minutesToHHMM(next().startMinute)}
                  </span>
                </Show>
              </p>
            </div>
          </div>
        )}
      </Show>

      <Show when={stops().length > 1}>
        <ol class="mt-4 flex flex-wrap gap-x-3 gap-y-1 font-coord text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <For each={stops()}>
            {(s) => (
              <li classList={{ "text-foreground": s.id === props.today.next?.id }}>{s.name}</li>
            )}
          </For>
        </ol>
      </Show>

      <A
        href={`/trips/${props.today.trip.id}`}
        class="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline active:scale-[0.98]"
      >
        Open today's plan · {plural(stops().length, "stop")}
        <ArrowRight class="h-4 w-4" aria-hidden="true" />
      </A>
    </section>
  );
}
