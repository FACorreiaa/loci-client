import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { ArrowRight, CalendarDays, Compass, MapPin, Plus } from "lucide-solid";
import { useTrips } from "~/lib/api/trips";
import { Button } from "~/ui/button";
import TripGlobe from "~/components/features/Globe/TripGlobe";

export default function TripsList() {
  const trips = useTrips();

  return (
    <main class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <section class="loci-hero mb-8">
        <div class="loci-hero__content grid gap-8 p-6 sm:p-9 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p class="font-coord mb-3 text-[10px] uppercase tracking-[0.2em] text-primary-foreground/65">
              Expedition desk · {trips.data?.length || 0} routes
            </p>
            <h1 class="max-w-2xl text-4xl text-primary-foreground sm:text-5xl">
              Your adventures, made workable.
            </h1>
            <p class="mt-4 max-w-xl text-sm leading-6 text-primary-foreground/72 sm:text-base">
              Keep the places that feel right, move the rest, and leave with a day-by-day route you
              can actually follow.
            </p>
          </div>
          <A href="/discover">
            <Button class="gap-2 border border-primary-foreground/25 bg-primary-foreground text-primary hover:bg-primary-foreground/90">
              <Plus class="h-4 w-4" />
              Plan a new trip
            </Button>
          </A>
        </div>
      </section>

      {/* Globe above the grid, not instead of it. The cards answer "which
          trip?"; the globe answers "how far apart are these actually?", which
          a flat card grid cannot express. */}
      <Show when={trips.data && trips.data.length > 0}>
        <section aria-labelledby="trips-globe-heading" class="mb-8">
          <h2 id="trips-globe-heading" class="sr-only">
            Your trips on a globe
          </h2>
          <TripGlobe trips={trips.data!} class="h-[380px]" />
        </section>
      </Show>

      <Show when={trips.isLoading}>
        <div class="grid gap-4 md:grid-cols-2">
          <For each={[1, 2, 3, 4]}>
            {() => <div class="h-44 animate-pulse rounded-xl border border-border bg-card" />}
          </For>
        </div>
      </Show>

      <Show when={trips.data && trips.data.length === 0}>
        <section class="rounded-xl border border-dashed border-border bg-card/70 px-6 py-16 text-center">
          <Compass class="mx-auto h-8 w-8 text-accent" />
          <h2 class="mt-5 text-2xl">No route pinned yet</h2>
          <p class="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Start with a city, a mood, or one place you refuse to miss. Loci will sketch the first
            route and you can make it yours.
          </p>
          <A href="/discover" class="mt-6 inline-block">
            <Button>Find your first stop</Button>
          </A>
        </section>
      </Show>

      <ul class="grid gap-4 md:grid-cols-2">
        <For each={trips.data}>
          {(trip, index) => (
            <li>
              <A
                href={`/trips/${trip.id}`}
                class="group block min-h-52 overflow-hidden loci-card-interactive rounded-xl"
              >
                <div class="flex h-full flex-col p-6">
                  <div class="flex items-start justify-between gap-4">
                    <span class="font-coord text-[10px] uppercase tracking-[0.18em] text-accent">
                      Route {String(index() + 1).padStart(2, "0")}
                    </span>
                    <span class="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                      {trip.days.length} day{trip.days.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <h2 class="mt-7 text-2xl leading-tight">{trip.title}</h2>
                  <div class="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin class="h-4 w-4 text-accent" />
                    {trip.cityName || "Open route"}
                  </div>
                  <div class="mt-auto flex items-end justify-between gap-4 pt-8">
                    <span class="flex items-center gap-2 font-coord text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <CalendarDays class="h-3.5 w-3.5" />
                      Updated {new Date(trip.updatedAt).toLocaleDateString()}
                    </span>
                    <span class="grid h-9 w-9 place-items-center rounded-full border border-border transition group-hover:border-accent group-hover:bg-accent group-hover:text-accent-foreground">
                      <ArrowRight class="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </A>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
