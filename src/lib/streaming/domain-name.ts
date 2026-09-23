// The proto DomainType as the name the client routes and stores use. Its own
// module so reconnect.ts can name a RunInfo's domain without pulling in the
// stream reader (and its transport) for it.
import { DomainType } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";

export const domainName = (d: DomainType): string => {
  switch (d) {
    case DomainType.ACCOMMODATION:
      return "accommodation";
    case DomainType.DINING:
      return "dining";
    case DomainType.ACTIVITIES:
      return "activities";
    case DomainType.ITINERARY:
      return "itinerary";
    case DomainType.TRANSPORT:
      return "transport";
    default:
      return "general";
  }
};
