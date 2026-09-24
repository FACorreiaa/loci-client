// One "saved" list out of two sources: the copies on this device (IndexedDB,
// openable offline) and the account's bookmarks (server, metadata only).
import type { OfflineItinerary } from "./itinerary-offline-store";

/** The slice of a server bookmark this list reads. */
export interface CloudBookmark {
  id: string;
  title: string;
  description?: string;
  primary_city_id?: string;
  /** The session it was saved from, when the server kept one. */
  session_id?: string;
  created_at?: string;
}

export interface SavedItinerary {
  key: string;
  title: string;
  cityName: string;
  description?: string;
  /** ISO. The newer of the two sources when both exist. */
  savedAt: string;
  stopCount?: number;
  /** Set when a full copy is on this device; the item opens offline. */
  offlineId?: string;
  /** Set when the account has a bookmark for it. */
  cloudId?: string;
  /** Where to open it. */
  href?: string;
}

export const savedItineraryHref = (sessionId: string, cityName: string): string =>
  `/itinerary?sessionId=${encodeURIComponent(sessionId)}&cityName=${encodeURIComponent(cityName)}&domain=itinerary`;

/**
 * Where an account bookmark with no copy on this device opens. With a session
 * the planner fetches the whole plan from the server, as it does on any
 * device; without one, the bookmark's own page shows what the server kept.
 */
export const cloudItineraryHref = (c: CloudBookmark): string =>
  c.session_id
    ? savedItineraryHref(c.session_id, "")
    : `/itinerary/saved/${encodeURIComponent(c.id)}`;

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();
const ms = (iso: string | undefined) => {
  const t = new Date(iso ?? "").getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Offline copies come first-class. A cloud bookmark folds into its copy when the
 * titles match — the server keeps no session id, so the title is the only handle
 * there is.
 *
 * City is compared only when BOTH sides have one. The bookmark RPC accepts a
 * `primary_city_name` but persists only `primary_city_id`, and the client has
 * never sent an id, so every bookmark ever written has an empty city. Requiring
 * the cities to match therefore guaranteed a miss, and every saved itinerary
 * showed up twice: once as a device copy, once as a cloud row with a blank city.
 *
 * A bookmark that kept its session folds into the device copy of that session
 * first, whatever the titles say. Cloud-only bookmarks stay visible and open
 * through cloudItineraryHref.
 */
export function mergeSavedItineraries(
  offline: OfflineItinerary[],
  cloud: CloudBookmark[],
): SavedItinerary[] {
  const items: SavedItinerary[] = offline.map((o) => ({
    key: `offline:${o.id}`,
    title: o.title,
    cityName: o.cityName,
    description: o.description,
    savedAt: o.savedAt,
    stopCount: o.stopCount,
    offlineId: o.id,
    href: savedItineraryHref(o.id, o.cityName),
  }));

  // Several device copies can share a title (the same city planned twice), so
  // keep them all and pick the one whose city agrees, if any side names one.
  const byTitle = new Map<string, SavedItinerary[]>();
  for (const i of items) {
    const k = norm(i.title);
    const bucket = byTitle.get(k);
    if (bucket) bucket.push(i);
    else byTitle.set(k, [i]);
  }

  for (const c of cloud) {
    const sameSession = c.session_id
      ? items.find((i) => i.offlineId === c.session_id && !i.cloudId)
      : undefined;
    if (sameSession) {
      sameSession.cloudId = c.id;
      if (ms(c.created_at) > ms(sameSession.savedAt))
        sameSession.savedAt = c.created_at ?? sameSession.savedAt;
      continue;
    }
    const candidates = byTitle.get(norm(c.title)) ?? [];
    const cloudCity = norm(c.primary_city_id);
    const existing = candidates.find(
      (i) =>
        // One device copy cannot stand in for two different bookmarks.
        !i.cloudId && (!cloudCity || !norm(i.cityName) || norm(i.cityName) === cloudCity),
    );
    if (existing) {
      existing.cloudId = c.id;
      if (ms(c.created_at) > ms(existing.savedAt))
        existing.savedAt = c.created_at ?? existing.savedAt;
      continue;
    }
    items.push({
      key: `cloud:${c.id}`,
      title: c.title,
      // Deliberately blank: the server holds a city *id*, and printing a UUID
      // where a city name belongs is worse than printing nothing.
      cityName: "",
      description: c.description || undefined,
      savedAt: c.created_at ?? "",
      cloudId: c.id,
      href: cloudItineraryHref(c),
    });
  }

  return items.sort((a, b) => ms(b.savedAt) - ms(a.savedAt));
}
