import { createEffect, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { CalendarPlus, Check } from "lucide-solid";
import { useQueryClient } from "@tanstack/solid-query";
import { fetchTrip, tripKeys, useAddStop, useTrips } from "~/lib/api/trips";
import type { POI } from "~/lib/api/types";

interface AddToTripButtonProps {
  poi: POI;
}

export default function AddToTripButton(props: AddToTripButtonProps) {
  const tripsQuery = useTrips();
  const addStop = useAddStop();
  const qc = useQueryClient();
  const [fetching, setFetching] = createSignal(false);
  const [open, setOpen] = createSignal(false);
  const [tripID, setTripID] = createSignal("");
  const [dayID, setDayID] = createSignal("");
  const [message, setMessage] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const trips = () => tripsQuery.data ?? [];
  const selectedTrip = () => trips().find((trip) => trip.id === tripID());

  createEffect(() => {
    if (!tripID() && trips().length > 0) setTripID(trips()[0].id);
  });

  createEffect(() => {
    const trip = selectedTrip();
    if (trip && !trip.days.some((day) => day.id === dayID())) setDayID(trip.days[0]?.id ?? "");
  });

  const add = async () => {
    const listed = selectedTrip();
    if (!listed || !dayID()) return;
    setError(null);
    setMessage(null);
    // The trips list can be minutes old (and AddStop does not refresh it), so
    // its version is stale after any edit — including the previous add from
    // this very button. Read the trip fresh and send that version instead.
    setFetching(true);
    let trip;
    try {
      trip = await fetchTrip(listed.id);
    } catch {
      setError("We couldn't load that trip. Try again.");
      return;
    } finally {
      setFetching(false);
    }
    const day = trip.days.find((candidate) => candidate.id === dayID());
    if (!day) {
      setError("That day is no longer on the trip. Pick another.");
      void qc.invalidateQueries({ queryKey: tripKeys.list() });
      return;
    }
    addStop.mutate(
      {
        tripId: trip.id,
        dayId: day.id,
        baseVersion: trip.version,
        stop: {
          id: crypto.randomUUID(),
          poiId: props.poi.id,
          orderIndex: day.stops.length,
          name: props.poi.name,
          notes:
            props.poi.recommendation_rationale ||
            props.poi.description_poi ||
            "Added from Discover",
          recommendationTrace: props.poi.recommendation_trace,
        },
      },
      {
        onSuccess: () => {
          // The list carries each trip's days, stops and version; keep it in
          // step so the next add (or the /trips page) is not a version behind.
          void qc.invalidateQueries({ queryKey: tripKeys.list() });
          setMessage(`Added to Day ${day.dayNumber}`);
          setOpen(false);
        },
        onError: () => setError("We couldn't add this place. Refresh the trip and try again."),
      },
    );
  };

  return (
    <div class="relative">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary transition-all hover:-translate-y-px hover:bg-primary/10 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          setOpen((value) => !value);
          setMessage(null);
          setError(null);
        }}
        aria-expanded={open()}
      >
        <CalendarPlus class="h-3.5 w-3.5" />
        Add to trip
      </button>
      <Show when={message()}>
        <span class="ml-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
          <Check class="h-3.5 w-3.5" /> {message()}
        </span>
      </Show>

      <Show when={open()}>
        <div class="absolute bottom-full left-0 z-30 mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <p class="text-sm font-semibold">Add {props.poi.name}</p>
          <Show
            when={!tripsQuery.isLoading}
            fallback={<div class="mt-3 h-20 animate-pulse rounded-lg bg-muted" />}
          >
            <Show
              when={trips().length > 0}
              fallback={
                <div class="mt-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                  <p>Create a trip first, then bring this place along.</p>
                  <A
                    href="/trips"
                    class="mt-2 inline-block font-medium text-primary hover:underline"
                  >
                    Open trips
                  </A>
                </div>
              }
            >
              <div class="mt-3 grid gap-2 sm:grid-cols-2">
                <label class="text-xs font-medium text-muted-foreground">
                  Trip
                  <select
                    class="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                    value={tripID()}
                    onChange={(event) => setTripID(event.currentTarget.value)}
                  >
                    <For each={trips()}>
                      {(trip) => <option value={trip.id}>{trip.title}</option>}
                    </For>
                  </select>
                </label>
                <label class="text-xs font-medium text-muted-foreground">
                  Day
                  <select
                    class="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                    value={dayID()}
                    onChange={(event) => setDayID(event.currentTarget.value)}
                  >
                    <For each={selectedTrip()?.days ?? []}>
                      {(day) => <option value={day.id}>Day {day.dayNumber}</option>}
                    </For>
                  </select>
                </label>
              </div>
              <button
                type="button"
                class="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
                disabled={!dayID() || addStop.isPending || fetching()}
                onClick={() => void add()}
              >
                {addStop.isPending || fetching() ? "Adding…" : "Add to this day"}
              </button>
            </Show>
          </Show>
          <Show when={error()}>
            <p class="mt-2 text-xs text-destructive" role="alert">
              {error()}
            </p>
          </Show>
        </div>
      </Show>
    </div>
  );
}
