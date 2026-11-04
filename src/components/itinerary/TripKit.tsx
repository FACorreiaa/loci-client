import { createMemo, createSignal, createEffect, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import {
  CalendarPlus,
  Crown,
  Download,
  MapPinned,
  Lock,
  Sparkles,
  CheckCircle2,
} from "lucide-solid";
import {
  FREE_STOPS_PER_DAY,
  allDays,
  dateInputValue,
  dateOfDay,
  dayIndexOf,
  dayRouteUrls,
  downloadCalendarForTrip,
  fitDayRange,
  groupStopsByDay,
  lockedDayCount,
  moveRangeFrom,
  moveRangeTo,
  parseLocalDate,
  sliceDays,
  tripDateRange,
  unlockedStops,
  type TripDayRange,
  type TripStop,
} from "~/lib/trip-kit";
import { PLAN_GATING_ENABLED } from "~/lib/subscription";
import { exportItineraryToPDF } from "~/lib/api/export";
import { create } from "@bufbuild/protobuf";
import { ExportItinerarySchema } from "@buf/loci_loci-proto.bufbuild_es/loci/export/export_pb.js";

export interface TripKitProps {
  title: string;
  cityName: string;
  summary?: string;
  stops: TripStop[];
  isPro: boolean;
  /**
   * Whether the plan behind `isPro` is actually known yet.
   *
   * It matters because `isPro` is derived from a query, and an unresolved or
   * failed query reads as `false` — indistinguishable from a genuine free
   * account. A Pro user who exported before it settled silently got a Day-1
   * file and no indication why. "unknown" keeps that from passing as "free".
   */
  planState?: "loading" | "known" | "unknown";
  /** Visible when stream is done (or has enough stops to be useful). */
  visible: boolean;
  stopsPerDay?: number;
  /**
   * What the free tier gets, said in the page's own words. A one-day list
   * (hotels, restaurants, activities) is entirely Day 1, so the free plan
   * exports all of it; the page says so here rather than leaving the Pro
   * banner to imply something is held back.
   */
  note?: string;
  /**
   * Externally controlled trip start date (yyyy-mm-dd).
   * When provided, the date picker is initialised with this value and
   * any subsequent change also writes back via onStartDateChange.
   */
  startDate?: string;
  /** Called whenever the user changes the trip start date. */
  onStartDateChange?: (date: string) => void;
  /** When true, shows a "Saved on this device" indicator in the header. */
  isSaved?: boolean;
  /**
   * Per-stop notes keyed by stop name. Populated by the parent when an
   * offline record is restored; written back via onStopNotesChange.
   */
  stopNotes?: Record<string, string>;
  /** Called whenever a stop note changes. */
  onStopNotesChange?: (notes: Record<string, string>) => void;
}

export default function TripKit(props: TripKitProps) {
  const [busy, setBusy] = createSignal<"cal" | "pdf" | null>(null);
  const [toast, setToast] = createSignal<string | null>(null);
  const [notesOpen, setNotesOpen] = createSignal(false);
  // Local notes state — starts from props and updates live.
  const [localNotes, setLocalNotes] = createSignal<Record<string, string>>(props.stopNotes ?? {});

  // Sync from parent when the prop changes (e.g. after async offline restore).
  createEffect(() => {
    if (props.stopNotes) setLocalNotes(props.stopNotes);
  });

  const planState = () => props.planState ?? "known";
  // Exporting while the plan is still being fetched is what silently truncated
  // a Pro user's calendar, so the actions wait rather than guess.
  // With gating off there is no plan to wait for.
  const planPending = () => PLAN_GATING_ENABLED && planState() === "loading";

  const perDay = () => props.stopsPerDay ?? FREE_STOPS_PER_DAY;
  const days = createMemo(() => groupStopsByDay(props.stops, perDay()));
  const locked = createMemo(() => lockedDayCount({ ...props, stopsPerDay: perDay() }));
  const dayCount = createMemo(() => days().length);

  // Day 1 starts here. The .ics has always been able to start on a given day;
  // nothing ever told it which, so every download landed on tomorrow no matter
  // when the trip actually was. Defaulting to tomorrow keeps that behaviour for
  // anybody who ignores the field.
  const DAY_START_HOUR = 9;
  const tomorrowValue = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [startValue, setStartValue] = createSignal(props.startDate ?? tomorrowValue());
  // Sync when the parent restores a persisted date asynchronously.
  createEffect(() => {
    if (props.startDate) setStartValue(props.startDate);
  });
  const startDate = createMemo(() => parseLocalDate(startValue(), DAY_START_HOUR));
  // Free plans export day 1 only, so the range is cut from what will actually
  // be written rather than from how long the trip is.
  const unlockedDays = createMemo(() =>
    groupStopsByDay(unlockedStops({ ...props, stopsPerDay: perDay() }), perDay()),
  );
  // Undefined until the range is touched: every day, however many there turn
  // out to be once the plan has loaded.
  const [pickedRange, setPickedRange] = createSignal<TripDayRange | undefined>();
  const range = createMemo(() => {
    const count = unlockedDays().length;
    return fitDayRange(pickedRange() ?? allDays(count), count);
  });
  const selectedDays = createMemo(() => sliceDays(unlockedDays(), range()));
  const rangeStart = createMemo(() => {
    const start = startDate();
    return start ? dateOfDay(start, range().from) : null;
  });
  const rangeLabel = createMemo(() => {
    const start = rangeStart();
    return start ? tripDateRange(start, selectedDays().length) : "";
  });
  const dayValue = (index: number) => {
    const start = startDate();
    return start ? dateInputValue(dateOfDay(start, index)) : "";
  };
  const lastDayValue = () => dayValue(Math.max(unlockedDays().length - 1, 0));
  // Typing can get past min and max, and clearing a field gives "": a date
  // that isn't real leaves the range as it was.
  const pickDay = (value: string, move: typeof moveRangeFrom) => {
    const start = startDate();
    const picked = parseLocalDate(value, DAY_START_HOUR);
    if (!start || !picked) return;
    const count = unlockedDays().length;
    setPickedRange(move(range(), dayIndexOf(picked, start, count), count));
  };
  const dayRoutes = createMemo(() =>
    selectedDays().map((day, position) => {
      const start = rangeStart();
      return {
        label: `Day ${range().from + position + 1}`,
        date: start
          ? dateOfDay(start, position).toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })
          : "",
        ...dayRouteUrls(day.stops, props.cityName),
      };
    }),
  );

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const kitInput = () => ({
    title: props.title,
    cityName: props.cityName,
    summary: props.summary,
    stops: props.stops,
    stopsPerDay: perDay(),
    isPro: props.isPro,
  });

  // Enrich stops with per-stop notes for export operations so notes appear
  // in calendar event descriptions and PDF packs.
  const stopsWithNotes = () => {
    const notes = localNotes();
    if (Object.keys(notes).length === 0) return props.stops;
    return props.stops.map((s) => ({
      ...s,
      blurb: notes[s.name] ? [notes[s.name], s.blurb].filter(Boolean).join(" · ") : s.blurb,
    }));
  };

  const kitInputWithNotes = () => ({
    ...kitInput(),
    stops: stopsWithNotes(),
  });

  const handleCalendar = () => {
    setBusy("cal");
    try {
      const start = rangeStart();
      if (!start) {
        flash("Pick the first day of the trip first.");
        return;
      }
      const result = downloadCalendarForTrip(
        kitInputWithNotes(),
        { startDate: start, dayStartHour: DAY_START_HOUR },
        range(),
      );
      if (!result.ok) {
        flash("Nothing to add to the calendar yet.");
      } else if (result.locked) {
        // An unconfirmed plan still exports, but it says so. Silently handing a
        // Pro user Day 1 and calling it a free-tier limit is the bug.
        flash(
          planState() === "unknown"
            ? "We couldn't confirm your plan, so this is Day 1 only. Reload and try again."
            : "Downloaded Day 1 calendar. Pro unlocks every day.",
        );
      } else {
        flash("Calendar file downloaded.");
      }
    } finally {
      setBusy(null);
    }
  };

  const handlePdf = async () => {
    if (!props.isPro && dayCount() > 1) {
      // Free gets day-1 PDF only; soft gate multi-day as Pro CTA.
      // Still allow single-day free export.
    }
    setBusy("pdf");
    try {
      const exportStops = props.isPro
        ? stopsWithNotes()
        : (groupStopsByDay(stopsWithNotes(), perDay())[0]?.stops ??
          stopsWithNotes().slice(0, perDay()));

      const items = exportStops.map((s, i) => {
        const dayNumber = (s.day ?? Math.floor(i / perDay())) + 1;
        return {
          dayNumber,
          timeSlot: s.timeToSpend || "",
          name: s.name,
          description: s.blurb || "",
          address: s.address || "",
          durationMinutes: 90,
          notes: s.category || "",
        };
      });

      const itinerary = create(ExportItinerarySchema, {
        id: "trip-kit",
        title: props.isPro
          ? props.title || `${props.cityName} Itinerary`
          : `${props.title || props.cityName} — Day 1`,
        description: props.summary || "",
        cityName: props.cityName,
        totalDays: props.isPro ? dayCount() : 1,
        items,
      });

      await exportItineraryToPDF(itinerary);
      flash(
        props.isPro || dayCount() <= 1
          ? "PDF downloaded."
          : "Day 1 PDF downloaded. Upgrade to Pro for the full multi-day pack.",
      );
    } catch (e) {
      console.error("Trip Kit PDF failed:", e);
      flash("Could not generate PDF. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Show when={props.visible && props.stops.length > 0}>
      <section
        class="mt-8 rounded-2xl border border-border bg-card shadow-lg overflow-hidden"
        aria-labelledby="trip-kit-heading"
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div class="bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 px-5 py-4 border-b border-border">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.18em] text-accent font-semibold mb-1 flex items-center gap-1.5">
                <Sparkles class="w-3.5 h-3.5" />
                Trip Kit
              </p>
              <h2 id="trip-kit-heading" class="text-xl font-bold text-foreground">
                Take this plan with you
              </h2>
              <p class="text-sm text-muted-foreground mt-1 max-w-prose">
                {props.isPro
                  ? `Full ${dayCount()}-day kit: Maps routes, calendar blocks, and PDF pack.`
                  : dayCount() > 1
                    ? `Day 1 is free. Unlock ${locked()} more day${locked() === 1 ? "" : "s"} with Pro.`
                    : "Open in Maps, add to calendar, or download a PDF."}
              </p>
              <Show when={props.note}>
                <p class="text-xs text-muted-foreground mt-1 max-w-prose">{props.note}</p>
              </Show>
              {/* Saved indicator — shows once the itinerary has an offline copy */}
              <Show when={props.isSaved}>
                <p class="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent">
                  <CheckCircle2 class="w-3.5 h-3.5" aria-hidden="true" />
                  Saved on this device
                </p>
              </Show>
            </div>
            <Show when={!props.isPro && locked() > 0}>
              <span class="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 border border-primary/20">
                <Lock class="w-3 h-3" />
                {locked()} day{locked() === 1 ? "" : "s"} locked
              </span>
            </Show>
          </div>
        </div>

        {/* ── Action grid ───────────────────────────────────────────── */}
        <div class="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Add to calendar */}
          <button
            type="button"
            class="flex flex-col items-start gap-2 rounded-xl border border-border bg-background px-4 py-3 text-left hover:border-primary/40 hover:bg-muted/40 transition focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={handleCalendar}
            disabled={busy() !== null || planPending() || !rangeStart()}
          >
            <CalendarPlus class="w-5 h-5 text-primary" />
            <span class="font-semibold text-foreground text-sm">
              {busy() === "cal" ? "Building…" : "Add to calendar"}
            </span>
            <span class="text-xs text-muted-foreground">
              {planPending()
                ? "Checking your plan…"
                : rangeLabel()
                  ? `Timed events for ${rangeLabel()} (.ics)`
                  : "Pick the first day of the trip"}
            </span>
          </button>

          {/* Trip starts date picker */}
          <div class="flex flex-col items-start gap-2 rounded-xl border border-border bg-background px-4 py-3">
            <label
              for="trip-start-date"
              class="font-semibold text-foreground text-sm cursor-pointer"
            >
              Trip starts
            </label>
            {/* A native date input: src/ui has no calendar primitive, and one
                field does not justify adding a picker dependency. */}
            <input
              id="trip-start-date"
              type="date"
              class="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={startValue()}
              onInput={(e) => {
                setStartValue(e.currentTarget.value);
                props.onStartDateChange?.(e.currentTarget.value);
              }}
            />
            <span class="text-xs text-muted-foreground">
              {rangeLabel() ? `Exporting ${rangeLabel()}` : "Pick the first day of the trip"}
            </span>
          </div>

          {/* From / To: which days Maps and Calendar export */}
          <Show when={unlockedDays().length > 1 && startDate()}>
            <div class="flex flex-col items-start gap-2 rounded-xl border border-border bg-background px-4 py-3">
              <label for="trip-range-from" class="font-semibold text-foreground text-sm">
                From · Day {range().from + 1}
              </label>
              <input
                id="trip-range-from"
                type="date"
                class="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                min={dayValue(0)}
                max={lastDayValue()}
                value={dayValue(range().from)}
                onChange={(e) => {
                  pickDay(e.currentTarget.value, moveRangeFrom);
                  e.currentTarget.value = dayValue(range().from);
                }}
              />
              <label for="trip-range-to" class="font-semibold text-foreground text-sm">
                To · Day {range().to + 1}
              </label>
              <input
                id="trip-range-to"
                type="date"
                class="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                min={dayValue(range().from)}
                max={lastDayValue()}
                value={dayValue(range().to)}
                onChange={(e) => {
                  pickDay(e.currentTarget.value, moveRangeTo);
                  e.currentTarget.value = dayValue(range().to);
                }}
              />
            </div>
          </Show>

          {/* Download PDF */}
          <button
            type="button"
            class="flex flex-col items-start gap-2 rounded-xl border border-border bg-background px-4 py-3 text-left hover:border-primary/40 hover:bg-muted/40 transition focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={() => void handlePdf()}
            disabled={busy() !== null || planPending()}
          >
            <Download class="w-5 h-5 text-primary" />
            <span class="font-semibold text-foreground text-sm">
              {busy() === "pdf" ? "Generating…" : "Download PDF"}
            </span>
            <span class="text-xs text-muted-foreground">
              {props.isPro ? "Full city pack PDF" : "Day 1 PDF pack"}
            </span>
          </button>
        </div>

        {/* ── Routes: real links, because several window.open calls in a
            row get popup-blocked ─────────────────────────────────── */}
        <div class="px-5 pb-5">
          <p class="flex items-center gap-2 font-semibold text-foreground text-sm mb-2">
            <MapPinned class="w-5 h-5 text-primary" />
            Walking routes
          </p>
          <Show
            when={!planPending()}
            fallback={<p class="text-xs text-muted-foreground">Checking your plan…</p>}
          >
            <ul class="divide-y divide-border rounded-xl border border-border bg-background">
              <For each={dayRoutes()}>
                {(route) => (
                  <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                    <span class="text-sm text-foreground">
                      {route.label}
                      <Show when={route.date}>
                        <span class="text-muted-foreground"> · {route.date}</span>
                      </Show>
                    </span>
                    <span class="flex gap-3 text-sm font-medium">
                      <Show when={route.google}>
                        {(url) => (
                          <a
                            href={url()}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                          >
                            Google Maps
                          </a>
                        )}
                      </Show>
                      <Show when={route.apple}>
                        {(url) => (
                          <a
                            href={url()}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                          >
                            Apple Maps
                          </a>
                        )}
                      </Show>
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>

        {/* ── Stop notes section ────────────────────────────────────── */}
        <Show when={props.stops.length > 0}>
          <div class="border-t border-border">
            <button
              type="button"
              class="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
              onClick={() => setNotesOpen((o) => !o)}
              aria-expanded={notesOpen()}
              aria-controls="trip-kit-notes"
            >
              <span>Add notes to stops</span>
              <span class="text-xs">{notesOpen() ? "▲" : "▼"}</span>
            </button>
            <Show when={notesOpen()}>
              <div id="trip-kit-notes" class="px-5 pb-5 space-y-3">
                <p class="text-xs text-muted-foreground">
                  Notes appear in your downloaded calendar events and PDF.
                </p>
                <For each={props.stops}>
                  {(stop) => (
                    <div class="flex flex-col gap-1">
                      <label
                        for={`note-${stop.name.replace(/\s+/g, "-")}`}
                        class="text-xs font-medium text-foreground truncate"
                      >
                        {stop.name}
                      </label>
                      <input
                        id={`note-${stop.name.replace(/\s+/g, "-")}`}
                        type="text"
                        class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="e.g. Book in advance · best in the morning"
                        value={localNotes()[stop.name] ?? ""}
                        onInput={(e) => {
                          const updated = { ...localNotes(), [stop.name]: e.currentTarget.value };
                          setLocalNotes(updated);
                          props.onStopNotesChange?.(updated);
                        }}
                      />
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        {/* ── Pro upsell / Pro confirmed ────────────────────────────── */}
        <Show when={!props.isPro}>
          <div class="mx-5 mb-5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="flex items-start gap-2">
              <Crown class="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p class="text-sm font-semibold text-foreground">
                  Unlock the full Trip Kit with Pro
                </p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Multi-day Maps + calendar, unlimited AI planning, MCP itinerary generation.
                </p>
              </div>
            </div>
            <A
              href="/pricing"
              class="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition shrink-0"
            >
              Upgrade to Pro
            </A>
          </div>
        </Show>

        <Show when={props.isPro}>
          <div class="mx-5 mb-5 flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 class="w-4 h-4 text-accent" />
            Pro active — full trip exports unlocked.
          </div>
        </Show>

        <Show when={toast()}>
          <p class="px-5 pb-4 text-xs text-muted-foreground" role="status">
            {toast()}
          </p>
        </Show>
      </section>
    </Show>
  );
}
