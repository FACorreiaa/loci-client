// One "saved" list out of two sources: the copies on this device (IndexedDB,
// openable offline) and the account's bookmarks (server, metadata only).
import type { OfflineItinerary } from "./itinerary-offline-store";

/** The slice of a server bookmark this list reads. */
export interface CloudBookmark {
  id: string;
  title: string;
  description?: string;
  primary_city_id?: string;
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
  /** Where to open it. Absent for a cloud-only bookmark: the server holds no content yet. */
  href?: string;
}

export const savedItineraryHref = (sessionId: string, cityName: string): string =>
  `/itinerary?sessionId=${encodeURIComponent(sessionId)}&cityName=${encodeURIComponent(cityName)}&domain=itinerary`;

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();
const matchKey = (title: string | undefined, city: string | undefined) =>
  `${norm(title)}|${norm(city)}`;
const ms = (iso: string | undefined) => {
  const t = new Date(iso ?? "").getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Offline copies come first-class. A cloud bookmark with the same title and
 * city folds into its copy — the server keeps no session id, so title + city
 * is the only handle there is. Cloud-only bookmarks stay visible so nothing a
 * person saved goes missing, but they cannot open until the server stores
 * content.
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

  const byMatch = new Map(items.map((i) => [matchKey(i.title, i.cityName), i]));

  for (const c of cloud) {
    const existing = byMatch.get(matchKey(c.title, c.primary_city_id));
    if (existing) {
      existing.cloudId = c.id;
      if (ms(c.created_at) > ms(existing.savedAt))
        existing.savedAt = c.created_at ?? existing.savedAt;
      continue;
    }
    items.push({
      key: `cloud:${c.id}`,
      title: c.title,
      cityName: c.primary_city_id ?? "",
      description: c.description || undefined,
      savedAt: c.created_at ?? "",
      cloudId: c.id,
    });
  }

  return items.sort((a, b) => ms(b.savedAt) - ms(a.savedAt));
}
