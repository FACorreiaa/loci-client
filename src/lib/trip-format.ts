import { TripPace } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import type { TripDay } from "~/lib/api/trips";

/** Minutes-from-midnight → "09:30". Empty string when unset, so it can feed an <input type="time">. */
export const minutesToHHMM = (m?: number) => {
  if (m == null) return "";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export const hhmmToMinutes = (v: string): number | undefined => {
  if (!v) return undefined;
  const [h, m] = v.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
  return h * 60 + m;
};

export const PACE_LABELS: Record<number, string> = {
  [TripPace.UNSPECIFIED]: "—",
  [TripPace.RELAXED]: "Relaxed",
  [TripPace.MODERATE]: "Moderate",
  [TripPace.PACKED]: "Packed",
};

/** Budget levels are 1–4 on the wire; money glyphs read faster than a number. */
export const BUDGET_LABELS: Record<number, string> = { 1: "€", 2: "€€", 3: "€€€", 4: "€€€€" };

/** "45 min" under an hour, "6h 15m" over it. Undefined for nothing to say. */
export const formatDuration = (minutes?: number) => {
  if (!minutes || minutes <= 0) return undefined;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export interface DaySummary {
  stopCount: number;
  /** Only present when the day's stops actually carry times. */
  window?: string;
  totalLabel?: string;
}

/**
 * The one-line "what does this day look like" summary above a day's stops.
 *
 * The window is first start → last end rather than first → last *start*, so a
 * long final stop is not silently dropped off the end of the day.
 */
export const summariseDay = (day: TripDay): DaySummary => {
  const timed = day.stops.filter((s) => s.startMinute != null);
  const total = day.stops.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  let window: string | undefined;
  if (timed.length > 0) {
    const starts = timed.map((s) => s.startMinute!);
    const ends = timed.map((s) => s.startMinute! + (s.durationMinutes ?? 0));
    window = `${minutesToHHMM(Math.min(...starts))}–${minutesToHHMM(Math.max(...ends))}`;
  }

  return { stopCount: day.stops.length, window, totalLabel: formatDuration(total) };
};

/**
 * "12–15 Sep" style range across a trip's days. Days carry an optional ISO
 * date; a trip with none at all gets nothing rather than a fabricated range.
 */
export const formatTripDates = (days: TripDay[]): string | undefined => {
  const dates = days
    .map((d) => d.date)
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return undefined;

  const first = dates[0];
  const last = dates[dates.length - 1];
  const day = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric" });
  const dayMonth = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

  if (first.getTime() === last.getTime()) return dayMonth(first);
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    return `${day(first)}–${dayMonth(last)}`;
  }
  return `${dayMonth(first)} – ${dayMonth(last)}`;
};
