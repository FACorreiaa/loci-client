import {
  ContentType,
  type ListWithDetailedItems,
  type POIDetailedInfo,
} from "@buf/loci_loci-proto.bufbuild_es/loci/list/list_pb.js";

export type ListContentKind = "poi" | "restaurant" | "hotel" | "itinerary";

export interface ListDetailItem {
  /** The saved thing's id (POI, restaurant, hotel or itinerary): the remove key. */
  itemId: string;
  kind: ListContentKind;
  name: string;
  category: string;
  description: string;
  address: string;
  rating: number;
  photo?: string;
  latitude?: number;
  longitude?: number;
  notes: string;
  position: number;
  dayNumber: number;
}

export interface ListDetail {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  isItinerary: boolean;
  cityId: string;
  itemCount: number;
  items: ListDetailItem[];
}

const KIND: Record<number, ListContentKind> = {
  [ContentType.POI]: "poi",
  [ContentType.RESTAURANT]: "restaurant",
  [ContentType.HOTEL]: "hotel",
  [ContentType.ITINERARY]: "itinerary",
};

const placed = (poi: POIDetailedInfo | undefined) =>
  poi &&
  Number.isFinite(poi.latitude) &&
  Number.isFinite(poi.longitude) &&
  !(poi.latitude === 0 && poi.longitude === 0)
    ? { latitude: poi.latitude, longitude: poi.longitude }
    : {};

/**
 * GetList(include_detailed_items) onto what the list page draws.
 *
 * The content arrives in one of four slots depending on the item's type; a
 * restaurant or hotel wraps its place in `.poi`. An item whose content the
 * server could not resolve (a deleted place) still shows, by id, so it can be
 * removed rather than haunting the count.
 */
export function mapListDetail(d: ListWithDetailedItems): ListDetail {
  const items = d.items.map((row): ListDetailItem => {
    const li = row.listItem;
    const poi = row.poi ?? row.restaurant?.poi ?? row.hotel?.poi;
    const kind =
      KIND[li?.contentType ?? 0] ??
      (row.restaurant ? "restaurant" : row.hotel ? "hotel" : row.itinerary ? "itinerary" : "poi");
    return {
      itemId: li?.itemId || li?.poiId || poi?.id || row.itinerary?.id || "",
      kind,
      name: poi?.name || row.itinerary?.title || "Unavailable place",
      category:
        row.restaurant?.cuisineType || poi?.category || (kind === "itinerary" ? "Itinerary" : ""),
      description: li?.itemAiDescription || poi?.description || row.itinerary?.description || "",
      address: poi?.address ?? "",
      rating: poi?.rating ?? 0,
      photo: poi?.photos?.[0] || undefined,
      notes: li?.notes ?? "",
      position: li?.position ?? 0,
      dayNumber: li?.dayNumber ?? 0,
      ...placed(poi),
    };
  });
  items.sort((a, b) => a.dayNumber - b.dayNumber || a.position - b.position);
  return {
    id: d.list?.id ?? "",
    name: d.list?.name ?? "",
    description: d.list?.description ?? "",
    isPublic: d.list?.isPublic ?? false,
    isItinerary: d.list?.isItinerary ?? false,
    cityId: d.list?.cityId ?? "",
    itemCount: d.list?.itemCount ?? items.length,
    items,
  };
}
