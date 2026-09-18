import { getDomainRoute } from "~/lib/streaming-service";
import type { DomainType } from "~/lib/api/types";
import type { ActivityEntry } from "./types";

/**
 * Where a feed row goes when it is clicked.
 *
 * This is a plain function rather than inline JSX because of one detail that is
 * easy to get wrong and impossible to see: **the link has to carry the original
 * message.**
 *
 * The result pages restore a past session out of `sessionStorage`, and
 * `readCompletedSession` reads a single key holding only the most recently
 * finished stream in the current tab. Opening `/recents` in a new tab and
 * clicking anything older than "the last thing I did here" therefore restores
 * nothing. `/hotels`, `/restaurants` and `/activities` then fall through and
 * re-run the search from `?message=` — and `/itinerary` does too, since the
 * change that shipped with this feed. Without the message they land on "Tell
 * Loci what you're looking for", which is the whole feed leading nowhere.
 *
 * Re-running is cheap: an identical prompt is served out of the durable
 * generation cache without a provider call.
 */
export function activityHref(entry: ActivityEntry, profileId?: string): string {
  switch (entry.kind) {
    case "prompt":
      return promptHref(entry, profileId);
    case "saved_itinerary":
      // A kept trip has a real chat session behind it whenever it was saved
      // from one. Without that, the only place it exists is the bookmarks list.
      return entry.refId
        ? withParams("/itinerary", {
            sessionId: entry.refId,
            cityName: entry.cityName,
            domain: "itinerary",
          })
        : "/bookmarks";
    case "favourite":
      return favouriteHref(entry);
    default:
      return "/recents";
  }
}

function promptHref(entry: ActivityEntry, profileId?: string): string {
  const domain = entry.detail;

  // getDomainRoute knows five domains and sends everything else to /itinerary.
  // "nearby" has its own page and being dropped on an itinerary is wrong, so it
  // is routed here rather than by widening that switch, which other callers
  // depend on.
  if (domain === "nearby") {
    return withParams("/nearme", { cityName: entry.cityName });
  }

  const base = getDomainRoute(domain as DomainType, entry.refId, entry.cityName);
  const [path, existing] = base.split("?");
  const params = new URLSearchParams(existing ?? "");
  if (entry.label) params.set("message", entry.label);
  if (profileId) params.set("profileId", profileId);
  return `${path}?${params.toString()}`;
}

function favouriteHref(entry: ActivityEntry): string {
  switch (entry.detail) {
    case "hotel":
      return `/hotels/${encodeURIComponent(entry.refId)}`;
    case "restaurant":
      return `/restaurants/${encodeURIComponent(entry.refId)}`;
    case "itinerary":
      return "/bookmarks";
    default:
      // There is no POI detail route, so a favourited place goes to the list it
      // lives in rather than to a 404.
      return "/favorites";
  }
}

function withParams(path: string, params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
