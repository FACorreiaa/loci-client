// What /hotels, /restaurants and /activities have in common, in one place.
//
// The three routes used to carry their own copy of the response unwrap, their
// own favourite payload and their own labels, and each copy had drifted: the
// hotels page read accommodation_response, the activities page did not read
// activities_response at all, and every favourite was saved under the place's
// name instead of its id. Pure functions, no framework, so all of it is
// testable without a DOM.
import type { FavoriteItem } from "~/lib/api/favorites";
import type { SessionListSection } from "~/lib/api/llm";
import type { GeneralCityData, POIDetailedInfo } from "~/lib/api/types";

export type ResultsDomain = "hotels" | "restaurants" | "activities";

export interface DomainMeta {
  key: ResultsDomain;
  /** "Hotels" */
  label: string;
  /** "hotel" */
  singular: string;
  emoji: string;
  /** What a favourite of this kind is saved as. */
  contentType: FavoriteItem["contentType"];
  /** The server's per-section list for a finished session. */
  section: SessionListSection;
  /** The domain envelope an older payload nests the list under. */
  responseKey: "accommodation_response" | "dining_response" | "activities_response";
  route: `/${ResultsDomain}`;
  /** What the map legend calls one pin. */
  stopLabel: string;
  /** The verb for the status rail while the stream runs. */
  searching: string;
}

export const DOMAINS: Record<ResultsDomain, DomainMeta> = {
  hotels: {
    key: "hotels",
    label: "Hotels",
    singular: "hotel",
    emoji: "🏨",
    contentType: "hotel",
    section: "hotels",
    responseKey: "accommodation_response",
    route: "/hotels",
    stopLabel: "Hotel",
    searching: "Finding places to stay…",
  },
  restaurants: {
    key: "restaurants",
    label: "Restaurants",
    singular: "restaurant",
    emoji: "🍽️",
    contentType: "restaurant",
    section: "restaurants",
    responseKey: "dining_response",
    route: "/restaurants",
    stopLabel: "Restaurant",
    searching: "Finding places to eat…",
  },
  activities: {
    key: "activities",
    label: "Activities",
    singular: "activity",
    emoji: "🎯",
    contentType: "poi",
    section: "activities",
    responseKey: "activities_response",
    route: "/activities",
    stopLabel: "Activity",
    searching: "Finding things to do…",
  },
};

/** "Hotels in Rome", or just "Hotels" when the city is not known yet. */
export const listTitle = (domain: ResultsDomain, cityName?: string): string =>
  cityName?.trim() ? `${DOMAINS[domain].label} in ${cityName.trim()}` : DOMAINS[domain].label;

export interface UnwrappedResults {
  /** The domain list, in the order the server gave it. */
  list: POIDetailedInfo[];
  /** Top-level places that are not in the list — "More to explore". */
  extras: POIDetailedInfo[];
  city?: GeneralCityData;
  sessionId?: string;
}

const asList = (v: unknown): POIDetailedInfo[] | null =>
  Array.isArray(v) && v.length > 0 ? (v as POIDetailedInfo[]) : null;

const identity = (poi: POIDetailedInfo): string => poi.id || poi.name;

/**
 * The domain list out of whatever shape the payload arrived in.
 *
 * Three shapes reach the pages, and this is the only place that knows them:
 *
 *   { hotels: [...] }                          a stream event, a restored
 *                                              session (proto v5.22.0+), the
 *                                              per-section server fallback
 *   { accommodation_response: { hotels } }     older domain envelopes
 *   { points_of_interest: [...] }              a general answer with no
 *                                              domain list at all
 *
 * The last is a fallback, not a merge: when the domain list exists, the
 * top-level places that are not in it become `extras`.
 *
 * Returns null for a payload with nothing to show. City data on its own
 * counts — the header names the place — but an empty object does not, which
 * is the guard that used to be `if (!data)` and let `{}` through as a
 * successful restore.
 */
export function unwrapDomainResults(data: unknown, domain: ResultsDomain): UnwrappedResults | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const envelope = record[DOMAINS[domain].responseKey] as Record<string, unknown> | undefined;

  const list = asList(record[domain]) ?? asList(envelope?.[domain]);
  const general = asList(record.points_of_interest) ?? [];
  const city = (record.general_city_data ?? envelope?.general_city_data) as
    | GeneralCityData
    | undefined;
  const sessionId = (record.session_id ?? envelope?.session_id) as string | undefined;

  if (!list && general.length === 0 && !city) return null;

  if (!list) return { list: general, extras: [], city, sessionId };

  const seen = new Set(list.map(identity));
  const extras = general.filter((poi) => !seen.has(identity(poi)));
  return { list, extras, city, sessionId };
}

/** Whether a payload has anything a domain page could render. */
export const hasDomainResults = (data: unknown, domain: ResultsDomain): boolean =>
  unwrapDomainResults(data, domain) !== null;

/**
 * What saving a place from a list sends to the account.
 *
 * The id is the place's id, never its name: the saved hub links a favourite
 * to /hotels/{id}, and a name there is a dead link. City and coordinates go
 * along so the hub can say where the place is without loading it.
 */
export function favoritePayload(
  poi: POIDetailedInfo,
  domain: ResultsDomain,
  cityName?: string,
): FavoriteItem {
  return {
    id: poi.id,
    name: poi.name,
    contentType: DOMAINS[domain].contentType,
    description: poi.description_poi || poi.description || "",
    llmInteractionId: poi.llm_interaction_id || undefined,
    cityName: poi.city || cityName || undefined,
    latitude: typeof poi.latitude === "number" ? poi.latitude : undefined,
    longitude: typeof poi.longitude === "number" ? poi.longitude : undefined,
    rating: typeof poi.rating === "number" && poi.rating > 0 ? poi.rating : undefined,
    category: poi.category || undefined,
  };
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Today's line out of an opening-hours value.
 *
 * The wire carries hours as a map of weekday to text, which mapPoi
 * serialises to JSON; older rows and hand-written data are one string. Both
 * are accepted. Returns undefined when nothing is known for today.
 */
export function todayHours(
  hours: string | Record<string, string> | undefined | null,
  now: Date = new Date(),
): string | undefined {
  if (!hours) return undefined;
  let table: Record<string, string> | null = null;
  if (typeof hours === "object") {
    table = hours;
  } else {
    const text = hours.trim();
    if (!text) return undefined;
    if (text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") table = parsed as Record<string, string>;
      } catch {
        return text;
      }
    } else {
      return text;
    }
  }
  if (!table) return undefined;
  const entries = Object.entries(table);
  if (entries.length === 0) return undefined;
  const today = WEEKDAYS[now.getDay()];
  const hit = entries.find(([day]) => {
    const d = day.trim().toLowerCase();
    return d === today || d === today.slice(0, 3) || today.startsWith(d);
  });
  if (hit) return hit[1]?.trim() || undefined;
  // A single line that names no day applies every day.
  if (entries.length === 1) return entries[0][1]?.trim() || undefined;
  return undefined;
}

const TIME_RE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i;

const toMinutes = (raw: string): number | null => {
  const m = TIME_RE.exec(raw.trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toLowerCase().replace(/\./g, "");
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
};

/**
 * Whether a place is open at `now`, from today's hours line.
 *
 * Tri-state on purpose. The restaurant page used to show "Closed" for every
 * restaurant because it read a flag nothing ever set; a place whose hours
 * cannot be read is one we do not know about, and saying "Closed" for it is
 * a claim. Handles "9:00 AM – 10:00 PM", "09:00-22:00", "Open 24 hours",
 * "Closed", and a closing time past midnight.
 */
export function isOpenNow(
  hoursToday: string | undefined,
  now: Date = new Date(),
): boolean | undefined {
  if (!hoursToday) return undefined;
  const text = hoursToday.trim().toLowerCase();
  if (!text) return undefined;
  if (text.startsWith("closed")) return false;
  if (/24\s*hours|open 24|all day/.test(text)) return true;
  const parts = text.split(/\s*(?:–|—|-|to)\s*/);
  if (parts.length < 2) return undefined;
  const open = toMinutes(parts[0]);
  const close = toMinutes(parts[1]);
  if (open == null || close == null) return undefined;
  const current = now.getHours() * 60 + now.getMinutes();
  if (close > open) return current >= open && current < close;
  // Closes after midnight: open from `open` to 24:00, and 0:00 to `close`.
  return current >= open || current < close;
}
