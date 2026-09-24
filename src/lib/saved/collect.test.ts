import { describe, expect, it } from "vitest";
import { ContentType } from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import {
  countSaved,
  filterSaved,
  backFromSaved,
  decodeParam,
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
  it("opens every kind of place, marked as coming from /saved", () => {
    expect(placeHref(UUID, ContentType.HOTEL)).toBe(`/hotels/${UUID}?from=saved`);
    expect(placeHref(UUID, ContentType.RESTAURANT)).toBe(`/restaurants/${UUID}?from=saved`);
    expect(placeHref(UUID, ContentType.POI)).toBe(`/places/${UUID}?from=saved`);
  });

  it("opens a name-keyed row too, escaped: the page falls back to the saved snapshot", () => {
    expect(placeHref("Casa do Largo|38.71|-9.14", ContentType.HOTEL)).toBe(
      "/hotels/Casa%20do%20Largo%7C38.71%7C-9.14?from=saved",
    );
    expect(placeHref("a/b", ContentType.POI)).toBe("/places/a%2Fb?from=saved");
  });

  it("does not link an empty id or an itinerary", () => {
    expect(placeHref("  ", ContentType.HOTEL)).toBeUndefined();
    expect(placeHref(UUID, ContentType.ITINERARY)).toBeUndefined();
  });
});

describe("backFromSaved", () => {
  it("returns to /saved only when the page was opened from there", () => {
    expect(backFromSaved("saved")).toEqual({ href: "/saved?view=places", label: "Back to Saved" });
    expect(backFromSaved(undefined)).toBeUndefined();
    expect(backFromSaved("hotels")).toBeUndefined();
  });
});

describe("decodeParam", () => {
  it("round-trips what placeHref escaped", () => {
    expect(decodeParam(encodeURIComponent("Casa do Largo|38.71|-9.14"))).toBe(
      "Casa do Largo|38.71|-9.14",
    );
  });

  it("passes through a value that is not valid escaping", () => {
    expect(decodeParam("100%")).toBe("100%");
    expect(decodeParam(undefined)).toBe("");
  });
});

describe("placesToSaved", () => {
  it("carries the saved content type through, so removal can match it", () => {
    const [row] = placesToSaved([fav({ contentType: ContentType.HOTEL })]);
    expect(row.contentType).toBe(ContentType.HOTEL);
    expect(row.typeLabel).toBe("hotel");
    expect(row.href).toBe(`/hotels/${UUID}?from=saved`);
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
