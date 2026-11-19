/* ============================================================
   The itinerary page as a view of its trip.

   A generated itinerary is a list of rich cards: blurb, photo,
   priority. The trip saved from it is a thin, editable list:
   which stop, on which day, in what order. Once the trip exists
   it is the truth about order and membership, so the page draws
   the trip's stops and dresses each one with the generated card
   it came from. A stop the traveller added later has no generated
   card and is dressed with what the server knows about its place.

   Pure, so the join can be tested without a page.
   ============================================================ */

import type { Trip, TripStop } from "@/lib/api/trips";
import type { ItineraryStop } from "./createItineraryStream";

/** One day of the trip, as the list needs it to draw a heading. */
export interface ItineraryDayMeta {
  /** The trip day's id: what an edit names. */
  dayId: string;
  dayNumber: number;
  /** 0-based position in the trip; matches `ItineraryStop.day`. */
  day: number;
  label: string;
  cityName?: string;
}

export interface TripView {
  stops: ItineraryStop[];
  days: ItineraryDayMeta[];
}

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/** Case, accents and spacing folded away, so a name can be compared. */
export const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const usableId = (id?: string) => {
  const v = (id ?? "").trim().toLowerCase();
  return v && v !== NIL_UUID ? v : "";
};

/**
 * The trip's stops, in the trip's order, each carrying the generated card it
 * matches.
 *
 * A stop is matched to a generated card by place id first and by name second:
 * ids are exact, but a generation that had not saved its places yet has none,
 * and a name is all that is left. Each card is used once, so two stops with
 * the same name do not both claim the first card.
 *
 * A matched stop keeps the generated card's `key`, so the row that was on
 * screen before the trip arrived is the row that stays; nothing flickers.
 */
export function mergeTripIntoStops(trip: Trip, generated: ItineraryStop[]): TripView {
  const byId = new Map<string, ItineraryStop>();
  const byName = new Map<string, ItineraryStop[]>();
  for (const g of generated) {
    const id = usableId(g.placeId);
    if (id && !byId.has(id)) byId.set(id, g);
    const name = normalizeName(g.name);
    if (!name) continue;
    const list = byName.get(name);
    if (list) list.push(g);
    else byName.set(name, [g]);
  }
  const used = new Set<ItineraryStop>();
  const claim = (stop: TripStop): ItineraryStop | undefined => {
    const direct = byId.get(usableId(stop.poiId));
    if (direct && !used.has(direct)) {
      used.add(direct);
      return direct;
    }
    const named = byName.get(normalizeName(stop.name))?.find((g) => !used.has(g));
    if (named) used.add(named);
    return named;
  };

  const days = [...trip.days].sort((a, b) => a.dayNumber - b.dayNumber);
  const multiCity = new Set(days.map((d) => d.cityName || trip.cityName)).size > 1;
  const view: TripView = { stops: [], days: [] };

  days.forEach((day, position) => {
    view.days.push({
      dayId: day.id,
      dayNumber: day.dayNumber,
      day: position,
      label:
        multiCity && day.cityName ? `Day ${position + 1} · ${day.cityName}` : `Day ${position + 1}`,
      cityName: day.cityName || trip.cityName || undefined,
    });
    const ordered = [...day.stops].sort((a, b) => a.orderIndex - b.orderIndex);
    for (const stop of ordered) {
      const card = claim(stop);
      view.stops.push({
        ...(card ?? { key: stop.id, enriched: true }),
        // The trip's name wins: the traveller may have renamed the stop.
        name: stop.name,
        day: position,
        category: card?.category ?? stop.place?.category,
        blurb: card?.blurb ?? stop.place?.description ?? (stop.notes || undefined),
        rating: card?.rating ?? stop.place?.rating,
        imageUrl: card?.imageUrl ?? stop.image?.url,
        imageCredit:
          card?.imageCredit ??
          (stop.image
            ? {
                url: stop.image.url,
                source: stop.image.source,
                licence: stop.image.licence,
                attribution: stop.image.attribution,
                source_page_url: stop.image.sourcePageUrl,
              }
            : undefined),
        placeId: usableId(stop.poiId) || card?.placeId,
        tripStopId: stop.id,
        tripDayId: day.id,
        check: stop.check,
        dayDate: day.date,
        latitude: stop.latitude,
        longitude: stop.longitude,
        address: stop.address,
        cityName: day.cityName || trip.cityName || undefined,
      });
    }
  });
  return view;
}

/** The trip stop behind a row of the view, and the day it is on. */
export function findTripStop(trip: Trip, tripStopId: string | undefined) {
  if (!tripStopId) return undefined;
  for (const day of trip.days) {
    const stop = day.stops.find((s) => s.id === tripStopId);
    if (stop) return { stop, day };
  }
  return undefined;
}

/**
 * The ids of a day's stops with one of them moved one place up or down, or
 * null when it is already at that end. This is what ReorderStops takes.
 */
export function orderAfterNudge(
  trip: Trip,
  tripStopId: string,
  direction: "up" | "down",
): { dayId: string; orderedStopIds: string[] } | null {
  const found = findTripStop(trip, tripStopId);
  if (!found) return null;
  const ids = [...found.day.stops].sort((a, b) => a.orderIndex - b.orderIndex).map((s) => s.id);
  const at = ids.indexOf(tripStopId);
  const to = direction === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= ids.length) return null;
  [ids[at], ids[to]] = [ids[to], ids[at]];
  return { dayId: found.day.id, orderedStopIds: ids };
}
