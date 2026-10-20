// The trip journal as the page reads it: plain objects with dates, verdict
// names and visit sources instead of protobuf enums and timestamps.
import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";
import type {
  JournalDay,
  JournalStop,
  JournalVisit,
  TripJournal,
  TripPhoto,
} from "@buf/loci_loci-proto.bufbuild_es/loci/journal/journal_pb.js";
import { Verdict } from "@buf/loci_loci-proto.bufbuild_es/loci/ranking/ranking_pb.js";
import { VisitSource } from "@buf/loci_loci-proto.bufbuild_es/loci/travelhistory/travelhistory_pb.js";
import type { VerdictName } from "~/lib/ranking/flow";
import type { JournalPhotoView } from "./upload";

export type VisitSourceName = "trip" | "visit_event" | "manual" | "backfill" | "unknown";

export interface JournalStopView {
  id: string;
  poiId: string;
  name: string;
  startMinute?: number;
  notes: string;
  visitedAt?: Date;
  verdict?: VerdictName;
  photos: JournalPhotoView[];
}

export interface JournalVisitView {
  poiId: string;
  name: string;
  visitedAt?: Date;
  source: VisitSourceName;
  verdict?: VerdictName;
}

export interface JournalDayView {
  id: string;
  number: number;
  /** The calendar day, as local midnight; undefined for an undated day. */
  date?: Date;
  cityName: string;
  diary: string;
  stops: JournalStopView[];
  extras: JournalVisitView[];
  photos: JournalPhotoView[];
}

export interface JournalView {
  tripId: string;
  title: string;
  cityName: string;
  photosEnabled: boolean;
  days: JournalDayView[];
  /** Photos not tied to a day. */
  tripPhotos: JournalPhotoView[];
}

const VERDICTS: Partial<Record<Verdict, VerdictName>> = {
  [Verdict.LOVED]: "loved",
  [Verdict.FINE]: "fine",
  [Verdict.NOT_FOR_ME]: "not_for_me",
};

const SOURCES: Partial<Record<VisitSource, VisitSourceName>> = {
  [VisitSource.TRIP]: "trip",
  [VisitSource.VISIT_EVENT]: "visit_event",
  [VisitSource.MANUAL]: "manual",
  [VisitSource.BACKFILL]: "backfill",
};

const instant = (t?: Timestamp) => (t ? timestampDate(t) : undefined);

// A day's date is a calendar date carried as midnight UTC: read its UTC
// parts, or it becomes the day before anywhere west of UTC.
const calendarDate = (t?: Timestamp) => {
  const d = instant(t);
  return d ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : undefined;
};

export const toPhotoView = (p: TripPhoto): JournalPhotoView => ({
  id: p.id,
  url: p.url,
  caption: p.caption,
  dayId: p.dayId,
  stopId: p.stopId,
});

const toStop = (s: JournalStop): JournalStopView => ({
  id: s.stopId,
  poiId: s.poiId,
  name: s.name,
  startMinute: s.startMinute,
  notes: s.notes,
  visitedAt: instant(s.visitedAt),
  verdict: VERDICTS[s.verdict],
  photos: s.photos.map(toPhotoView),
});

const toVisit = (v: JournalVisit): JournalVisitView => ({
  poiId: v.poiId,
  name: v.name,
  visitedAt: instant(v.visitedAt),
  source: SOURCES[v.source] ?? "unknown",
  verdict: VERDICTS[v.verdict],
});

const toDay = (d: JournalDay): JournalDayView => ({
  id: d.dayId,
  number: d.dayNumber,
  date: calendarDate(d.date),
  cityName: d.cityName,
  diary: d.diary,
  stops: d.stops.map(toStop),
  extras: d.extraVisits.map(toVisit),
  photos: d.photos.map(toPhotoView),
});

export const toJournalView = (j: TripJournal): JournalView => ({
  tripId: j.tripId,
  title: j.title,
  cityName: j.cityName,
  photosEnabled: j.photosEnabled,
  days: j.days.map(toDay),
  tripPhotos: j.photos.map(toPhotoView),
});

/** How many of the day's planned stops were visited. */
export const visitedCount = (day: JournalDayView) => ({
  visited: day.stops.filter((s) => s.visitedAt).length,
  planned: day.stops.length,
});

/** "Day 2 · Tue 21 Oct", or "Day 2" for an undated day. */
export const dayHeading = (day: JournalDayView, locale?: string): string => {
  const head = `Day ${day.number}`;
  if (!day.date) return head;
  const date = day.date
    .toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })
    .replace(",", "");
  return `${head} · ${date}`;
};
