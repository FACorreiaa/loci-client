// The trip that belongs at the top of the desk: when, where, how long, and a way in.
import { createMemo, Show } from "solid-js";
import { A } from "@solidjs/router";
import { ArrowRight } from "lucide-solid";
import {
  daysUntil,
  tripCoords,
  tripDateRange,
  tripStopCount,
  untilLabel,
  type NextTrip,
} from "~/lib/dashboard/next-trip";
import { plural } from "~/lib/dashboard/format";
import NextTripWeather from "./NextTripWeather";

interface Props {
  next: NextTrip;
}

export default function NextTripBand(props: Props) {
  const trip = () => props.next.trip;

  const kicker = () => {
    if (!props.next.upcoming) return "latest route";
    const label = untilLabel(daysUntil(trip(), new Date()));
    return label ? `next trip · ${label}` : "next trip";
  };

  const heading = () => trip().cityName || trip().title;
  const showTitle = () => Boolean(trip().title) && trip().title !== heading();

  const meta = () =>
    [
      tripDateRange(trip()),
      plural(trip().days.length, "day"),
      plural(tripStopCount(trip()), "stop"),
    ]
      .filter(Boolean)
      .join(" · ");

  const coords = createMemo(() => tripCoords(trip()));

  return (
    <section class="loci-card mb-6 p-5 sm:p-6" aria-label="Next trip">
      <div class="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div class="min-w-0">
          <p class="kicker mb-2">{kicker()}</p>
          <h2 class="text-2xl text-foreground sm:text-3xl">{heading()}</h2>
          <Show when={showTitle()}>
            <p class="mt-1 text-sm text-muted-foreground">{trip().title}</p>
          </Show>
          <p class="mt-3 font-coord text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {meta()}
          </p>
          <A
            href={`/trips/${trip().id}`}
            class="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline active:scale-[0.98]"
          >
            Open
            <ArrowRight class="h-4 w-4" aria-hidden="true" />
          </A>
        </div>
        <NextTripWeather lat={coords()?.lat} lon={coords()?.lon} />
      </div>
    </section>
  );
}
