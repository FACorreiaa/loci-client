// One shape for everything a traveller has kept, whatever it came from.
import type { ContentType } from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";

/** Which chip a row belongs under. */
export type SavedView = "all" | "places" | "itineraries" | "recent";

export const SAVED_VIEWS: readonly SavedView[] = ["all", "places", "itineraries", "recent"];

export const isSavedView = (v: string | undefined): v is SavedView =>
  !!v && (SAVED_VIEWS as readonly string[]).includes(v);

interface SavedBase {
  /** Stable across renders and unique across sources. */
  key: string;
  title: string;
  /** Empty when nothing reliable is known — never a raw id. */
  cityName: string;
  /** ISO. Empty when the source kept no timestamp. */
  savedAt: string;
  /** Short uppercase label shown at the end of the row. */
  typeLabel: string;
  /** Absent when there is nothing to open. */
  href?: string;
}

export interface SavedPlace extends SavedBase {
  kind: "place";
  /** What the server stores. Often a display name on older rows. */
  itemId: string;
  contentType: ContentType;
}

export interface SavedItineraryItem extends SavedBase {
  kind: "itinerary";
  description?: string;
  stopCount?: number;
  /** A full copy is on this device and opens offline. */
  offlineId?: string;
  /** The account has a bookmark for it. */
  cloudId?: string;
}

export type SavedItem = SavedPlace | SavedItineraryItem;

/** What the hub knows about the whole collection, not one row. */
export type SavedStatus = "loading" | "signed-out" | "error" | "ready";

export interface SavedErrors {
  /** The account's favourites could not be read. */
  places?: unknown;
  /** The account's bookmarks could not be read. */
  itineraries?: unknown;
}
