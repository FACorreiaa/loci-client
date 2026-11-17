// The proto DomainType as the name the client routes and stores use. Its own
// module so reconnect.ts can name a RunInfo's domain without pulling in the
// stream reader (and its transport) for it.
import { DomainType } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";

const NAMES = new Map<number, string>([
  [DomainType.ACCOMMODATION, "accommodation"],
  [DomainType.DINING, "dining"],
  [DomainType.ACTIVITIES, "activities"],
  [DomainType.ITINERARY, "itinerary"],
  [DomainType.TRANSPORT, "transport"],
  [DomainType.GASTRONOMY, "gastronomy"],
]);

// Takes a plain number as well as a DomainType: getRunStatuses hands the enum
// back as a digit string. Anything else, or a value this build does not know,
// is "general".
export const domainName = (d: number): string => NAMES.get(d) ?? "general";
