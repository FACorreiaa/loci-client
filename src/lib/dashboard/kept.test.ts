import { describe, expect, it } from "vitest";
import { ContentType } from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { contentTypeLabel, recentFavorites, type KeptFavorite } from "./kept";

const fav = (itemId: string, addedSeconds?: number): KeptFavorite => ({
  itemId,
  itemName: itemId,
  cityName: "Porto",
  contentType: ContentType.POI,
  addedAt: addedSeconds == null ? undefined : { seconds: BigInt(addedSeconds), nanos: 0 },
});

describe("contentTypeLabel", () => {
  it("names each kind in field-guide words", () => {
    expect(contentTypeLabel(ContentType.POI)).toBe("place");
    expect(contentTypeLabel(ContentType.RESTAURANT)).toBe("restaurant");
    expect(contentTypeLabel(ContentType.HOTEL)).toBe("hotel");
    expect(contentTypeLabel(ContentType.ITINERARY)).toBe("route");
    expect(contentTypeLabel(ContentType.UNSPECIFIED)).toBe("place");
  });
});

describe("recentFavorites", () => {
  it("tolerates undefined", () => {
    expect(recentFavorites(undefined)).toEqual([]);
  });

  it("orders newest first and caps at five", () => {
    const list = [fav("a", 1), fav("b", 5), fav("c", 3), fav("d", 6), fav("e", 2), fav("f", 4)];
    expect(recentFavorites(list).map((f) => f.itemId)).toEqual(["d", "b", "f", "c", "e"]);
  });

  it("keeps undated records in server order after dated ones", () => {
    const list = [fav("x"), fav("a", 1), fav("y"), fav("b", 2)];
    expect(recentFavorites(list).map((f) => f.itemId)).toEqual(["b", "a", "x", "y"]);
  });
});
