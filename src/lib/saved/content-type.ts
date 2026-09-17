// The favourites API speaks strings; the proto rows carry the enum. Removal
// has to send back the content type the row was SAVED with — the server keys
// on (user, item_id, content_type), so guessing "poi" deleted nothing for
// every saved hotel and restaurant.
import { ContentType } from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";

export type ContentTypeName = "poi" | "hotel" | "restaurant" | "itinerary";

export function contentTypeToString(ct: ContentType): ContentTypeName {
  switch (ct) {
    case ContentType.HOTEL:
      return "hotel";
    case ContentType.RESTAURANT:
      return "restaurant";
    case ContentType.ITINERARY:
      return "itinerary";
    default:
      return "poi";
  }
}
