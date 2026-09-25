import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import {
  ContentType,
  HotelDetailedInfoSchema,
  ListItemSchema,
  ListItemWithContentSchema,
  ListSchema,
  ListWithDetailedItemsSchema,
  POIDetailedInfoSchema,
  RestaurantDetailedInfoSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/list/list_pb.js";
import { mapListDetail } from "./list-detail";

const poi = (id: string, name: string, lat = 38.7, lon = -9.1) =>
  create(POIDetailedInfoSchema, {
    id,
    name,
    latitude: lat,
    longitude: lon,
    category: "museum",
    photos: ["https://img/1.jpg"],
  });

const row = (itemId: string, type: ContentType, position: number, extra: object) =>
  create(ListItemWithContentSchema, {
    listItem: create(ListItemSchema, { itemId, contentType: type, position }),
    ...extra,
  });

describe("mapListDetail", () => {
  const detail = mapListDetail(
    create(ListWithDetailedItemsSchema, {
      list: create(ListSchema, { id: "l1", name: "Lisbon", isItinerary: true, itemCount: 4 }),
      items: [
        row("h1", ContentType.HOTEL, 2, {
          hotel: create(HotelDetailedInfoSchema, { poi: poi("h1", "Hotel A") }),
        }),
        row("p1", ContentType.POI, 0, { poi: poi("p1", "Gulbenkian") }),
        row("r1", ContentType.RESTAURANT, 1, {
          restaurant: create(RestaurantDetailedInfoSchema, {
            poi: poi("r1", "Taberna", 0, 0),
            cuisineType: "Portuguese",
          }),
        }),
        row("gone", ContentType.POI, 3, {}),
      ],
    }),
  );

  it("reads each kind from its own slot, in position order", () => {
    expect(detail.items.map((i) => [i.itemId, i.kind, i.name])).toEqual([
      ["p1", "poi", "Gulbenkian"],
      ["r1", "restaurant", "Taberna"],
      ["h1", "hotel", "Hotel A"],
      ["gone", "poi", "Unavailable place"],
    ]);
    expect(detail.items[1].category).toBe("Portuguese");
    expect(detail.isItinerary).toBe(true);
  });

  it("only places items with real coordinates on the map", () => {
    expect(detail.items[0].latitude).toBe(38.7);
    expect(detail.items[1].latitude).toBeUndefined(); // 0,0 is "unknown", not the Gulf of Guinea
    expect(detail.items[3].latitude).toBeUndefined();
  });

  it("keeps an unresolved item removable by id", () => {
    expect(detail.items[3].itemId).toBe("gone");
  });
});
