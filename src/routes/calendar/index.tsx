import { For, Show, createMemo, createSignal } from "solid-js";
import { A } from "@solidjs/router";
import { ChevronLeft, ChevronRight, Compass, MapPin } from "lucide-solid";
import { useSaveTrip, useTrips, type Trip } from "~/lib/api/trips";
import {
  CalendarEventSource,
  CalendarProvider,
  eventDateKey,
  useCalendarConnections,
  useCalendarEvents,
  usePushTripToCalendar,
} from "~/lib/api/calendar";
import {
  dateKey,
  monthCells,
  pinTripDates,
  tripBlocksOnCalendar,
  unscheduledTrips,
} from "~/lib/trip-calendar";
import { Button } from "~/ui/button";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const monthLabel = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

export default function CalendarPage() {
  const now = new Date();
  const trips = useTrips();
  const saveTrip = useSaveTrip();
  const connections = useCalendarConnections();
  const pushTrip = usePushTripToCalendar();
  const [cursor, setCursor] = createSignal({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedKey, setSelectedKey] = createSignal(dateKey(now));
  const [pinningId, setPinningId] = createSignal<string | null>(null);
  const [pinStart, setPinStart] = createSignal(dateKey(now));

  const monthStart = createMemo(() => new Date(cursor().year, cursor().month, 1));
  const monthEnd = createMemo(() => new Date(cursor().year, cursor().month + 1, 1));
  const overlay = useCalendarEvents(monthStart, monthEnd);
  const cells = createMemo(() => monthCells(cursor().year, cursor().month));
  const blocks = createMemo(() => tripBlocksOnCalendar(trips.data ?? []));
  const googleConnectionId = createMemo(
    () => (connections.data ?? []).find((c) => c.provider === CalendarProvider.GOOGLE)?.id,
  );
  const overlayByDay = createMemo(() => {
    const map = new Map<string, NonNullable<typeof overlay.data>>();
    for (const ev of overlay.data ?? []) {
      if (ev.source === CalendarEventSource.LOCI_TRIP) continue;
      const key = eventDateKey(ev);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  });
  const byDay = createMemo(() => {
    const map = new Map<string, ReturnType<typeof tripBlocksOnCalendar>>();
    for (const block of blocks()) {
      const list = map.get(block.dateKey) ?? [];
      list.push(block);
      map.set(block.dateKey, list);
    }
    return map;
  });
  const unscheduled = createMemo(() => unscheduledTrips(trips.data ?? []));
  const selectedBlocks = createMemo(() => byDay().get(selectedKey()) ?? []);

  const shiftMonth = (delta: number) => {
    const { year, month } = cursor();
    const next = new Date(year, month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const pin = async (trip: Trip) => {
    const [y, m, d] = pinStart().split("-").map(Number);
    const start = new Date(y, m - 1, d);
    const updated = pinTripDates(trip, start);
    await saveTrip.mutateAsync({ trip: updated, baseVersion: trip.version });
    setPinningId(null);
  };

  return (
    <main class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <section class="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="font-coord mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Field calendar
          </p>
          <h1 class="text-4xl sm:text-5xl">When you are going.</h1>
          <p class="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Dated trips land on the month. Pin a start date on anything still floating as Day 1, 2,
            3.
          </p>
        </div>
        <A href="/trips">
          <Button variant="outline">All trips</Button>
        </A>
      </section>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section class="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div class="mb-4 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft class="h-4 w-4" />
            </Button>
            <h2 class="font-serif text-2xl">{monthLabel(cursor().year, cursor().month)}</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight class="h-4 w-4" />
            </Button>
          </div>

          <div class="grid grid-cols-7 gap-1 text-center font-coord text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <For each={WEEKDAYS}>{(d) => <div class="py-2">{d}</div>}</For>
          </div>

          <div class="grid grid-cols-7 gap-1">
            <For each={cells()}>
              {(cell) => {
                const dayBlocks = () => byDay().get(cell.dateKey) ?? [];
                const selected = () => selectedKey() === cell.dateKey;
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedKey(cell.dateKey)}
                    class={`min-h-20 rounded-lg border p-1.5 text-left transition-colors ${
                      selected()
                        ? "border-accent bg-accent/15"
                        : "border-transparent hover:border-border hover:bg-secondary/50"
                    } ${cell.inMonth ? "text-foreground" : "text-muted-foreground/50"}`}
                  >
                    <span class="font-coord text-[11px]">{cell.day}</span>
                    <div class="mt-1 space-y-0.5">
                      <For each={dayBlocks().slice(0, 2)}>
                        {(block) => (
                          <span class="block truncate rounded-sm bg-accent/80 px-1 py-0.5 text-[10px] font-semibold text-accent-foreground">
                            {block.title}
                          </span>
                        )}
                      </For>
                      <For each={(overlayByDay().get(cell.dateKey) ?? []).slice(0, 1)}>
                        {(ev) => (
                          <span class="block truncate rounded-sm bg-secondary px-1 py-0.5 text-[10px] text-muted-foreground">
                            {ev.title}
                          </span>
                        )}
                      </For>
                      <Show when={dayBlocks().length > 2}>
                        <span class="block px-1 text-[10px] text-muted-foreground">
                          +{dayBlocks().length - 2}
                        </span>
                      </Show>
                    </div>
                  </button>
                );
              }}
            </For>
          </div>
        </section>

        <aside class="space-y-6">
          <section class="rounded-xl border border-border bg-card p-5">
            <h2 class="font-serif text-xl">
              {new Date(selectedKey() + "T12:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            <Show
              when={
                selectedBlocks().length > 0 || (overlayByDay().get(selectedKey()) ?? []).length > 0
              }
              fallback={
                <p class="mt-3 text-sm text-muted-foreground">No Loci trips on this day.</p>
              }
            >
              <ul class="mt-4 space-y-2">
                <For each={selectedBlocks()}>
                  {(block) => (
                    <li>
                      <A
                        href={`/trips/${block.tripId}`}
                        class="block rounded-lg border border-border px-3 py-2 hover:border-accent"
                      >
                        <p class="font-semibold">{block.title}</p>
                        <p class="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin class="h-3 w-3" />
                          {block.cityName || "Open route"} · Day {block.dayNumber}
                        </p>
                      </A>
                      <Show when={googleConnectionId()}>
                        <Button
                          class="mt-2"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            pushTrip.mutate({
                              tripId: block.tripId,
                              connectionId: googleConnectionId()!,
                            })
                          }
                          disabled={pushTrip.isPending}
                        >
                          Add to Google Calendar
                        </Button>
                      </Show>
                    </li>
                  )}
                </For>
                <For each={overlayByDay().get(selectedKey()) ?? []}>
                  {(ev) => (
                    <li class="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-sm">
                      {ev.title}
                      <span class="mt-0.5 block text-xs text-muted-foreground">
                        {ev.source === CalendarEventSource.CALENDLY ? "Calendly" : "Google"}
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>

          <section class="rounded-xl border border-dashed border-border bg-card/70 p-5">
            <h2 class="font-serif text-xl">Unscheduled</h2>
            <p class="mt-1 text-sm text-muted-foreground">Trips without calendar dates yet.</p>
            <Show
              when={unscheduled().length > 0}
              fallback={
                <p class="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Compass class="h-4 w-4" />
                  Everything has a date.
                </p>
              }
            >
              <ul class="mt-4 space-y-3">
                <For each={unscheduled()}>
                  {(trip) => (
                    <li class="rounded-lg border border-border p-3">
                      <p class="font-semibold">{trip.title || trip.cityName || "Untitled trip"}</p>
                      <p class="text-xs text-muted-foreground">
                        {trip.days.length} day{trip.days.length === 1 ? "" : "s"}
                      </p>
                      <Show
                        when={pinningId() === trip.id}
                        fallback={
                          <Button
                            class="mt-2"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPinningId(trip.id);
                              setPinStart(selectedKey());
                            }}
                          >
                            Pin dates
                          </Button>
                        }
                      >
                        <div class="mt-2 flex flex-wrap items-center gap-2">
                          <label class="text-xs text-muted-foreground">
                            Starts
                            <input
                              type="date"
                              class="ml-2 rounded-md border border-input bg-background px-2 py-1 text-sm"
                              value={pinStart()}
                              onInput={(e) => setPinStart(e.currentTarget.value)}
                            />
                          </label>
                          <Button size="sm" onClick={() => pin(trip)} disabled={saveTrip.isPending}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setPinningId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>
        </aside>
      </div>
    </main>
  );
}
