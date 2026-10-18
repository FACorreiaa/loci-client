// The "kept" lists: what the dashboard shows of a person's favourites.
import { ContentType } from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";

/** The slice of a proto FavoriteItem the dashboard reads. Structural, so tests need no proto. */
export interface KeptFavorite {
  itemId: string;
  itemName: string;
  cityName: string;
  contentType: ContentType;
  addedAt?: { seconds: bigint; nanos: number };
}

export const contentTypeLabel = (ct: ContentType): string => {
  switch (ct) {
    case ContentType.RESTAURANT:
      return "restaurant";
    case ContentType.HOTEL:
      return "hotel";
    case ContentType.ITINERARY:
      return "route";
    default:
      return "place";
  }
};

const addedMs = (f: KeptFavorite): number | undefined =>
  f.addedAt ? Number(f.addedAt.seconds) * 1000 + f.addedAt.nanos / 1e6 : undefined;

/** Newest first; records without a timestamp keep server order after the dated ones. */
export const recentFavorites = <T extends KeptFavorite>(
  favorites: T[] | undefined,
  limit = 5,
): T[] => {
  if (!favorites) return [];
  const dated = favorites
    .map((f, i) => ({ f, i, t: addedMs(f) }))
    .sort((a, b) => {
      if (a.t === undefined && b.t === undefined) return a.i - b.i;
      if (a.t === undefined) return 1;
      if (b.t === undefined) return -1;
      return b.t - a.t;
    });
  return dated.slice(0, limit).map((x) => x.f);
};
