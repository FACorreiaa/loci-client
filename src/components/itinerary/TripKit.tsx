import { createMemo, createSignal, Show } from "solid-js";
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
  downloadCalendarForTrip,
  groupStopsByDay,
  lockedDayCount,
  openMapsForTrip,
  parseLocalDate,
  tripDateRange,
  type TripStop,
} from "~/lib/trip-kit";
import { exportItineraryToPDF } from "~/lib/api/export";
import { create } from "@bufbuild/protobuf";
import { ExportItinerarySchema } from "@buf/loci_loci-proto.bufbuild_es/loci/export/export_pb.js";

export interface TripKitProps {
  title: string;
  cityName: string;
  summary?: string;
  stops: TripStop[];
  isPro: boolean;
  /** Visible when stream is done (or has enough stops to be useful). */
  visible: boolean;
  stopsPerDay?: number;
}

export default function TripKit(props: TripKitProps) {
  const [busy, setBusy] = createSignal<"maps" | "cal" | "pdf" | null>(null);
  const [toast, setToast] = createSignal<string | null>(null);

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
  const [startValue, setStartValue] = createSignal(tomorrowValue());
  const startDate = createMemo(() => parseLocalDate(startValue(), DAY_START_HOUR));
  // Free downloads carry day 1 only, so the range has to describe what will
  // actually be written rather than how long the trip is.
  const exportedDayCount = createMemo(() => (props.isPro ? dayCount() : Math.min(1, dayCount())));
  const rangeLabel = createMemo(() => {
    const start = startDate();
    return start ? tripDateRange(start, exportedDayCount()) : "";
  });

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

  const handleMaps = () => {
    setBusy("maps");
    try {
      const result = openMapsForTrip(kitInput());
      if (!result.ok) {
        flash("Add places with locations before opening Maps.");
      } else if (result.locked) {
        flash("Opened Day 1 in Maps. Upgrade to Pro for the full multi-day route.");
      } else {
        flash("Opened route in Google Maps.");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleCalendar = () => {
    setBusy("cal");
    try {
      const start = startDate();
      const result = downloadCalendarForTrip(
        kitInput(),
        start ? { startDate: start, dayStartHour: DAY_START_HOUR } : {},
      );
      if (!result.ok) {
        flash("Nothing to add to the calendar yet.");
      } else if (result.locked) {
        flash("Downloaded Day 1 calendar. Pro unlocks every day.");
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
        ? props.stops
        : (groupStopsByDay(props.stops, perDay())[0]?.stops ?? props.stops.slice(0, perDay()));

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
                  ? `Full ${dayCount()}-day kit: Maps route, calendar blocks, and PDF pack.`
                  : dayCount() > 1
                    ? `Day 1 is free. Unlock ${locked()} more day${locked() === 1 ? "" : "s"} with Pro.`
                    : "Open in Maps, add to calendar, or download a PDF."}
              </p>
            </div>
            <Show when={!props.isPro && locked() > 0}>
              <span class="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 border border-primary/20">
                <Lock class="w-3 h-3" />
                {locked()} day{locked() === 1 ? "" : "s"} locked
              </span>
            </Show>
          </div>
        </div>

        <div class="p-5 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            class="flex flex-col items-start gap-2 rounded-xl border border-border bg-background px-4 py-3 text-left hover:border-primary/40 hover:bg-muted/40 transition focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={handleMaps}
            disabled={busy() !== null}
          >
            <MapPinned class="w-5 h-5 text-primary" />
            <span class="font-semibold text-foreground text-sm">
              {busy() === "maps" ? "Opening…" : "Open in Google Maps"}
            </span>
            <span class="text-xs text-muted-foreground">
              {props.isPro ? "Full multi-stop walking route" : "Day 1 multi-stop route"}
            </span>
          </button>

          <button
            type="button"
            class="flex flex-col items-start gap-2 rounded-xl border border-border bg-background px-4 py-3 text-left hover:border-primary/40 hover:bg-muted/40 transition focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={handleCalendar}
            disabled={busy() !== null}
          >
            <CalendarPlus class="w-5 h-5 text-primary" />
            <span class="font-semibold text-foreground text-sm">
              {busy() === "cal" ? "Building…" : "Add to calendar"}
            </span>
            <span class="text-xs text-muted-foreground">
              {props.isPro ? "All days as timed events (.ics)" : "Day 1 timed blocks (.ics)"}
            </span>
          </button>

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
              onInput={(e) => setStartValue(e.currentTarget.value)}
            />
            <span class="text-xs text-muted-foreground">
              {rangeLabel() ? `Calendar covers ${rangeLabel()}` : "Pick the first day of the trip"}
            </span>
          </div>

          <button
            type="button"
            class="flex flex-col items-start gap-2 rounded-xl border border-border bg-background px-4 py-3 text-left hover:border-primary/40 hover:bg-muted/40 transition focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={() => void handlePdf()}
            disabled={busy() !== null}
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
