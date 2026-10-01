import { create } from "@bufbuild/protobuf";
import {
  SharedContentSchema,
  ShareContentType,
} from "@buf/loci_loci-proto.bufbuild_es/loci/share/share_pb.js";
import { describe, expect, it } from "vitest";
import { describeSharedContent, sharedContentPage } from "./shared-content";

const list = create(SharedContentSchema, {
  metadata: { contentType: ShareContentType.LIST },
  list: { id: "l1", name: "Lisbon cafés", description: "Warm pastel de nata.", itemCount: 8 },
});
const itinerary = create(SharedContentSchema, {
  metadata: { contentType: ShareContentType.ITINERARY },
  itinerary: { id: "i1", title: "Porto weekend", cityName: "Porto", durationDays: 2, stopCount: 9 },
});
const restaurant = create(SharedContentSchema, {
  metadata: { contentType: ShareContentType.RESTAURANT },
  restaurant: {
    id: "r1",
    name: "Tasca do Chico",
    address: "Rua 39",
    cuisineType: "Portuguese",
    rating: 4.6,
  },
});

describe("sharedContentPage", () => {
  it("points at the page the app serves for each kind", () => {
    expect(sharedContentPage(list)).toBe("/lists/l1");
    expect(sharedContentPage(itinerary)).toBe("/itinerary/saved/i1");
    expect(sharedContentPage(restaurant)).toBe("/places/r1");
    expect(sharedContentPage(create(SharedContentSchema, {}))).toBeNull();
  });
});

describe("describeSharedContent", () => {
  it("words a list", () => {
    expect(describeSharedContent(list)).toEqual({
      kicker: "A list",
      title: "Lisbon cafés",
      detail: "Warm pastel de nata.",
      summary: "8 places",
    });
  });
  it("words an itinerary", () => {
    expect(describeSharedContent(itinerary).summary).toBe("Porto · 2 days · 9 stops");
    expect(describeSharedContent(itinerary).kicker).toBe("An itinerary");
  });
  it("words a restaurant with its rating and cuisine", () => {
    const words = describeSharedContent(restaurant);
    expect(words.kicker).toBe("A restaurant");
    expect(words.detail).toBe("Rua 39");
    expect(words.summary).toBe("4.6 · Portuguese");
  });
  it("falls back to the metadata title when there is no body", () => {
    const bare = create(SharedContentSchema, {
      metadata: { title: "Something", contentType: ShareContentType.POI },
    });
    expect(describeSharedContent(bare)).toEqual({
      kicker: "A place",
      title: "Something",
      detail: "",
      summary: null,
    });
  });
});
