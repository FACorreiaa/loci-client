import { describe, expect, it } from "vitest";
import { ContentType } from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import {
  countSaved,
  filterSaved,
  isOpenableId,
  itinerariesToSaved,
  placeHref,
  placesToSaved,
  RECENT_LIMIT,
  sortSaved,
} from "./collect";
import type { SavedItem } from "./types";
import type { KeptFavorite } from "~/lib/dashboard/kept";

const UUID = "7f3a1b2c-0000-4000-8000-000000000001";

const at = (iso: string) => {
  const ms = new Date(iso).getTime();
  return { seconds: BigInt(Math.floor(ms / 1000)), nanos: 0 };
};

const fav = (over: Partial<KeptFavorite> = {}): KeptFavorite => ({
  itemId: UUID,
  itemName: "Sagrada Família",
  cityName: "Barcelona",
  contentType: ContentType.POI,
  addedAt: at("2026-09-10T10:00:00Z"),
  ...over,
});

describe("isOpenableId", () => {
  it("accepts a real id", () => {
    expect(isOpenableId(UUID)).toBe(true);
  });

  it("rejects the display names older rows were keyed by", () => {
    // Favourites were saved as `id: <name>` for a long time; those rows still
    // list and still unsave, but there is nothing to link to.
    expect(isOpenableId("hotel-avenida-palace")).toBe(false);
    expect(isOpenableId("Sagrada Família")).toBe(false);
    expect(isOpenableId("")).toBe(false);
  });
});

describe("placeHref", () => {
  it("links hotels and restaurants, which have detail routes", () => {
    expect(placeHref(UUID, ContentType.HOTEL)).toBe(`/hotels/${UUID}`);
    expect(placeHref(UUID, ContentType.RESTAURANT)).toBe(`/restaurants/${UUID}`);
  });

  it("does not link a POI: the app has no POI detail route", () => {
    expect(placeHref(UUID, ContentType.POI)).toBeUndefined();
  });

  it("does not link a name-keyed row", () => {
    expect(placeHref("hotel-avenida-palace", ContentType.HOTEL)).toBeUndefined();
  });
});

describe("placesToSaved", () => {
  it("carries the saved content type through, so removal can match it", () => {
    const [row] = placesToSaved([fav({ contentType: ContentType.HOTEL })]);
    expect(row.contentType).toBe(ContentType.HOTEL);
    expect(row.typeLabel).toBe("hotel");
    expect(row.href).toBe(`/hotels/${UUID}`);
  });

  it("keys rows by content type as well as id", () => {
    // The server's unique key is (user, item_id, content_type): the same place
    // saved as both a POI and a hotel is two rows, not one.
    const rows = placesToSaved([fav(), fav({ contentType: ContentType.HOTEL })]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  it("survives a row with no timestamp", () => {
    const [row] = placesToSaved([fav({ addedAt: undefined })]);
    expect(row.savedAt).toBe("");
  });

  it("returns nothing for undefined", () => {
    expect(placesToSaved(undefined)).toEqual([]);
  });
});

describe("itinerariesToSaved", () => {
  it("keeps provenance and falls back to a title", () => {
    const [row] = itinerariesToSaved([
      { key: "offline:s1", title: "", cityName: "Porto", savedAt: "", offlineId: "s1" },
    ]);
    expect(row.title).toBe("Untitled");
    expect(row.offlineId).toBe("s1");
    expect(row.typeLabel).toBe("route");
  });
});

describe("sortSaved", () => {
  it("puts newest first and undated rows last, in their original order", () => {
    const out = sortSaved([
      { savedAt: "", id: "no-date-1" },
      { savedAt: "2026-08-01T00:00:00Z", id: "old" },
      { savedAt: "", id: "no-date-2" },
      { savedAt: "2026-09-15T00:00:00Z", id: "new" },
    ]);
    expect(out.map((o) => o.id)).toEqual(["new", "old", "no-date-1", "no-date-2"]);
  });
});

const place = (key: string, savedAt: string): SavedItem => ({
  kind: "place",
  key,
  title: key,
  cityName: "",
  savedAt,
  typeLabel: "place",
  itemId: key,
  contentType: ContentType.POI,
});

const route = (key: string, savedAt: string): SavedItem => ({
  kind: "itinerary",
  key,
  title: key,
  cityName: "",
  savedAt,
  typeLabel: "route",
});

describe("filterSaved", () => {
  const items = [place("p1", "2026-09-10T00:00:00Z"), route("r1", ""), place("p2", "")];

  it("all keeps everything", () => {
    expect(filterSaved(items, "all")).toHaveLength(3);
  });

  it("splits places from itineraries", () => {
    expect(filterSaved(items, "places").map((i) => i.key)).toEqual(["p1", "p2"]);
    expect(filterSaved(items, "itineraries").map((i) => i.key)).toEqual(["r1"]);
  });

  it("recent is the same rows, dated only, capped", () => {
    expect(filterSaved(items, "recent").map((i) => i.key)).toEqual(["p1"]);
    const many = Array.from({ length: RECENT_LIMIT + 5 }, (_, i) =>
      place(`p${i}`, "2026-09-10T00:00:00Z"),
    );
    expect(filterSaved(many, "recent")).toHaveLength(RECENT_LIMIT);
  });
});

describe("countSaved", () => {
  it("counts each chip, and recent only counts dated rows", () => {
    expect(
      countSaved([place("p1", "2026-09-10T00:00:00Z"), route("r1", ""), place("p2", "")]),
    ).toEqual({
      all: 3,
      places: 2,
      itineraries: 1,
      recent: 1,
    });
  });
});
