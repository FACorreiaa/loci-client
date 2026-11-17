// Hotel comparison and stay transport usage. Counts, booleans and the surface
// only: never the message, a link, a hotel's name or a city.
import { StayTransportStatus } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import type { StayTransport } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import type { HotelComparisonReport } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/hotel_report_pb.js";
import { capture } from "~/lib/analytics";

/** Where a report is read: the chat page, the itinerary's Ask Loci, the hold overlay. */
export type HotelReportSource = "chat" | "trip_chat" | "assistant";
/** How a hotel reaches a trip: the server's proposal, or the client's trip picker. */
export type HotelAddVia = "proposal" | "picker";
export type StayTransportSource = "trip" | "itinerary";

// A card is drawn again whenever its thread changes; a report is shown once.
const shown = new Set<string>();

export function trackHotelReportShown(
  source: HotelReportSource,
  report: HotelComparisonReport,
  hasProposal: boolean,
): void {
  const key = `${source}:${report.id}`;
  if (shown.has(key)) return;
  shown.add(key);
  capture("hotel_report_shown", {
    source,
    hotels: report.hotels.length,
    identified: report.hotels.filter((h) => h.identified).length,
    has_verdict: report.verdict.trim() !== "",
    has_pick: report.recommendedIndex !== undefined,
    has_proposal: hasProposal,
    web_search_used: report.webSearchUsed,
    sources: report.sources.length,
  });
}

export function trackHotelAddTapped(
  source: HotelReportSource,
  via: HotelAddVia,
  isPick: boolean,
): void {
  capture("hotel_report_add_tapped", { source, via, is_pick: isPick });
}

export function trackHotelStaySet(
  source: HotelReportSource,
  via: HotelAddVia,
  isPick: boolean,
  identified: boolean,
): void {
  capture("stay_set_from_report", { source, via, is_pick: isPick, identified });
}

const STATUS: Record<number, string> = {
  [StayTransportStatus.READY]: "ready",
  [StayTransportStatus.NO_COORDINATES]: "no_coordinates",
  [StayTransportStatus.UNAVAILABLE]: "unavailable",
};

/** `viewKey` names the stay locally so a redraw is not counted again; it is never sent. */
export function trackStayTransportViewed(
  source: StayTransportSource,
  transport: StayTransport,
  viewKey?: string,
): void {
  if (viewKey) {
    const key = `transport:${source}:${viewKey}`;
    if (shown.has(key)) return;
    shown.add(key);
  }
  capture("stay_transport_viewed", {
    source,
    status: STATUS[transport.status] ?? "unspecified",
    stops: transport.stops.length,
    day_starts: transport.dayStarts.length,
    has_airport: Boolean(transport.airport),
  });
}

export function trackStayDirectionsOpened(
  source: StayTransportSource,
  kind: "day" | "airport",
  mode?: string,
): void {
  capture("stay_directions_opened", mode ? { source, kind, mode } : { source, kind });
}

/** Tests only: forget which reports were counted. */
export const resetHotelAnalytics = () => shown.clear();
