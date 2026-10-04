import {
  type SharedContent,
  ShareContentType,
} from "@buf/loci_loci-proto.bufbuild_es/loci/share/share_pb.js";

/** What the share page says above the title, per kind. */
const kickers: Partial<Record<ShareContentType, string>> = {
  [ShareContentType.HOTEL]: "A hotel",
  [ShareContentType.RESTAURANT]: "A restaurant",
  [ShareContentType.ACTIVITY]: "An activity",
  [ShareContentType.ITINERARY]: "An itinerary",
  [ShareContentType.TRIP]: "An itinerary",
  [ShareContentType.LIST]: "A list",
};

export interface SharedContentWords {
  kicker: string;
  title: string;
  detail: string;
  summary: string | null;
}

/** The page this app serves for the shared thing, or null when there is none. */
export const sharedContentPage = (content: SharedContent): string | null => {
  if (content.list) return `/lists/${encodeURIComponent(content.list.id)}`;
  if (content.itinerary) return `/itinerary/saved/${encodeURIComponent(content.itinerary.id)}`;
  const place = content.poi ?? content.hotel ?? content.restaurant;
  return place ? `/places/${encodeURIComponent(place.id)}` : null;
};

const rating = (value: number) => (value > 0 ? value.toFixed(1) : "");
const joinDots = (parts: string[]) => parts.filter((p) => p !== "").join(" · ") || null;

/** Kicker, title, detail and a one-line summary, mirroring the iOS card. */
export const describeSharedContent = (content: SharedContent): SharedContentWords => {
  const type = content.metadata?.contentType ?? ShareContentType.UNSPECIFIED;
  const kicker = content.list?.isItinerary ? "An itinerary list" : (kickers[type] ?? "A place");
  const fallbackTitle = content.metadata?.title || "Shared from Loci";

  if (content.list) {
    const n = content.list.itemCount;
    return {
      kicker,
      title: content.list.name || fallbackTitle,
      detail: content.list.description,
      summary: n === 1 ? "1 place" : `${n} places`,
    };
  }
  if (content.itinerary) {
    const it = content.itinerary;
    return {
      kicker,
      title: it.title || fallbackTitle,
      detail: it.description,
      summary: joinDots([
        it.cityName,
        it.durationDays > 0 ? (it.durationDays === 1 ? "1 day" : `${it.durationDays} days`) : "",
        it.stopCount > 0 ? (it.stopCount === 1 ? "1 stop" : `${it.stopCount} stops`) : "",
      ]),
    };
  }
  if (content.restaurant) {
    const r = content.restaurant;
    return {
      kicker,
      title: r.name || fallbackTitle,
      detail: r.address,
      summary: joinDots([rating(r.rating), r.cuisineType]),
    };
  }
  if (content.hotel) {
    const h = content.hotel;
    return {
      kicker,
      title: h.name || fallbackTitle,
      detail: h.address,
      summary: joinDots([rating(h.rating), h.priceRange]),
    };
  }
  if (content.poi) {
    const p = content.poi;
    return {
      kicker,
      title: p.name || fallbackTitle,
      detail: p.address,
      summary: joinDots([rating(p.rating), p.category]),
    };
  }
  return {
    kicker,
    title: fallbackTitle,
    detail: content.metadata?.description ?? "",
    summary: null,
  };
};
