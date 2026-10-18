// Turning each source into rows, and rows into a view. Pure: no framework,
// no network, so the hub's behaviour is testable without a DOM.
import { ContentType } from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { contentTypeLabel, type KeptFavorite } from "~/lib/dashboard/kept";
import type { SavedItinerary } from "~/lib/saved-itineraries";
import type { SavedItem, SavedItineraryItem, SavedPlace, SavedView } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Favourites were saved keyed by display name for a long time, and iOS still
 * keys a place with no id as "name|lat|lon", so an id is only a database id
 * when it looks like one.
 */
export const isOpenableId = (itemId: string): boolean => UUID_RE.test(itemId.trim());

/** Marks a detail page as opened from /saved, so its Back link returns there. */
export const FROM_SAVED = "saved";

/**
 * Where a saved place opens. Every place opens, whatever its id: the detail
 * pages fall back to the saved snapshot when the id names nothing stored.
 */
export function placeHref(itemId: string, contentType: ContentType): string | undefined {
  const id = itemId.trim();
  if (!id) return undefined;
  const path = encodeURIComponent(id);
  switch (contentType) {
    case ContentType.HOTEL:
      return `/hotels/${path}?from=${FROM_SAVED}`;
    case ContentType.RESTAURANT:
      return `/restaurants/${path}?from=${FROM_SAVED}`;
    case ContentType.ITINERARY:
      // Itineraries arrive through their own source, not as favourites.
      return undefined;
    default:
      // POIs and activities share one page.
      return `/places/${path}?from=${FROM_SAVED}`;
  }
}

/** The Back link of a detail page opened from /saved; undefined otherwise. */
export function backFromSaved(from: unknown): { href: string; label: string } | undefined {
  return from === FROM_SAVED ? { href: "/saved?view=places", label: "Back to Saved" } : undefined;
}

/** A route param as the id it was built from; a value that is not valid escaping passes through. */
export function decodeParam(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const isoFromTimestamp = (ts: KeptFavorite["addedAt"]): string => {
  if (!ts) return "";
  const ms = Number(ts.seconds) * 1000 + ts.nanos / 1e6;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
};

/** Proto favourites → rows. */
export function placesToSaved(favorites: KeptFavorite[] | undefined): SavedPlace[] {
  if (!favorites) return [];
  return favorites.map((f) => ({
    kind: "place" as const,
    key: `place:${f.contentType}:${f.itemId}`,
    title: f.itemName,
    cityName: f.cityName ?? "",
    savedAt: isoFromTimestamp(f.addedAt),
    typeLabel: contentTypeLabel(f.contentType),
    itemId: f.itemId,
    contentType: f.contentType,
    href: placeHref(f.itemId, f.contentType),
  }));
}

/** Already-merged device/cloud itineraries → rows. */
export function itinerariesToSaved(items: SavedItinerary[]): SavedItineraryItem[] {
  return items.map((i) => ({
    kind: "itinerary" as const,
    key: i.key,
    title: i.title || "Untitled",
    cityName: i.cityName,
    savedAt: i.savedAt,
    typeLabel: "route",
    description: i.description,
    stopCount: i.stopCount,
    offlineId: i.offlineId,
    cloudId: i.cloudId,
    href: i.href,
  }));
}

const ms = (iso: string): number => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Newest first. Rows with no timestamp sort last but keep their order. */
export function sortSaved<T extends { savedAt: string }>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, i, t: ms(item.savedAt) }))
    .sort((a, b) => {
      if (a.t === 0 && b.t === 0) return a.i - b.i;
      if (a.t === 0) return 1;
      if (b.t === 0) return -1;
      return b.t - a.t;
    })
    .map((x) => x.item);
}

/** How many rows the "Recent" chip shows. */
export const RECENT_LIMIT = 20;

export function filterSaved(items: SavedItem[], view: SavedView): SavedItem[] {
  switch (view) {
    case "places":
      return items.filter((i) => i.kind === "place");
    case "itineraries":
      return items.filter((i) => i.kind === "itinerary");
    case "recent":
      // Not a different source — the same rows, only the newest, and only
      // those that actually carry a date.
      return items.filter((i) => i.savedAt !== "").slice(0, RECENT_LIMIT);
    default:
      return items;
  }
}

export interface SavedCounts {
  all: number;
  places: number;
  itineraries: number;
  recent: number;
}

export function countSaved(items: SavedItem[]): SavedCounts {
  const places = items.filter((i) => i.kind === "place").length;
  const itineraries = items.filter((i) => i.kind === "itinerary").length;
  return {
    all: items.length,
    places,
    itineraries,
    recent: Math.min(items.filter((i) => i.savedAt !== "").length, RECENT_LIMIT),
  };
}
