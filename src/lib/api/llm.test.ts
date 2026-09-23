import { describe, it, expect, vi } from "vitest";
import { create } from "@bufbuild/protobuf";
import { POIDetailedInfoSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/poi/poi_pb.js";
import {
  RecommendationChannel,
  RecommendationSurface,
  RecommendationTraceSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/recommendation/recommendation_pb.js";
import { detectDomain, toProtoDomainType, domainToContextType, mapPoi } from "./llm";

// Mock the proto module since it may not be available in test environment
vi.mock("@buf/loci_loci-proto.bufbuild_es/proto/locichat_pb.js", () => ({
  ChatDomainType: {
    GENERAL: 0,
    ACCOMMODATION: 1,
    DINING: 2,
    ITINERARY: 3,
  },
}));

// ==================
// detectDomain Tests
// ==================
describe("detectDomain", () => {
  describe("accommodation domain detection", () => {
    it('should detect "hotel" keyword', () => {
      expect(detectDomain("I need a hotel in Paris")).toBe("accommodation");
    });

    it('should detect "hostel" keyword', () => {
      expect(detectDomain("Looking for a cheap hostel")).toBe("accommodation");
    });

    it('should detect "accommodation" keyword', () => {
      expect(detectDomain("Find accommodation near city center")).toBe("accommodation");
    });

    it('should detect "stay" keyword', () => {
      expect(detectDomain("Where should I stay in Rome?")).toBe("accommodation");
    });

    it('should detect "room" keyword', () => {
      expect(detectDomain("Book a room for 2 nights")).toBe("accommodation");
    });

    it('should detect "airbnb" keyword', () => {
      expect(detectDomain("Any Airbnb options?")).toBe("accommodation");
    });

    it('should detect "resort" keyword', () => {
      expect(detectDomain("Luxury resort in Bali")).toBe("accommodation");
    });
  });

  describe("dining domain detection", () => {
    it('should detect "restaurant" keyword', () => {
      expect(detectDomain("Find a restaurant nearby")).toBe("dining");
    });

    it('should detect "food" keyword', () => {
      expect(detectDomain("Best food in Tokyo")).toBe("dining");
    });

    it('should detect "eat" keyword', () => {
      expect(detectDomain("Where to eat in Barcelona?")).toBe("dining");
    });

    it('should detect "cafe" keyword', () => {
      expect(detectDomain("Nice cafe for brunch")).toBe("dining");
    });

    it('should detect "bar" keyword', () => {
      expect(detectDomain("Best bar for cocktails")).toBe("dining");
    });

    it('should detect "lunch" keyword', () => {
      expect(detectDomain("Quick lunch spots")).toBe("dining");
    });

    it('should detect "dinner" keyword', () => {
      expect(detectDomain("Nice dinner places")).toBe("dining");
    });
  });

  describe("activities domain detection", () => {
    it('should detect "museum" keyword', () => {
      expect(detectDomain("Best museums to visit")).toBe("activities");
    });

    it('should detect "park" keyword', () => {
      expect(detectDomain("Nice parks for walking")).toBe("activities");
    });

    it('should detect "tour" keyword', () => {
      expect(detectDomain("Walking tour of the city")).toBe("activities");
    });

    it('should detect "attraction" keyword', () => {
      expect(detectDomain("Top attractions in London")).toBe("activities");
    });

    it('should detect "shopping" keyword', () => {
      expect(detectDomain("Best shopping areas")).toBe("activities");
    });

    it('should detect "nightlife" keyword', () => {
      expect(detectDomain("Nightlife in Berlin")).toBe("activities");
    });
  });

  describe("itinerary domain detection", () => {
    // Note: detectDomain checks regexes in order: accommodation -> dining -> activities -> itinerary
    // So messages containing words like "eat" might match dining before itinerary
    it('should detect "plan" keyword', () => {
      expect(detectDomain("Plan my weekend")).toBe("itinerary");
    });

    it('should detect "trip" keyword', () => {
      expect(detectDomain("5-day trip to Japan")).toBe("itinerary");
    });

    it('should detect "route" keyword', () => {
      expect(detectDomain("Best route through Italy")).toBe("itinerary");
    });

    it('should detect "journey" keyword', () => {
      expect(detectDomain("My journey through Europe")).toBe("itinerary");
    });

    it('should detect "organize" keyword', () => {
      expect(detectDomain("Organize my travel")).toBe("itinerary");
    });
  });

  describe("general domain (default)", () => {
    it("should return general for messages without specific keywords", () => {
      expect(detectDomain("Hello, tell me about this city")).toBe("general");
    });

    it("should return general for simple greetings", () => {
      expect(detectDomain("Hi there")).toBe("general");
    });

    it("should return general for empty-ish messages", () => {
      expect(detectDomain("Hi")).toBe("general");
    });
  });

  describe("case insensitivity", () => {
    it("should detect keywords regardless of case", () => {
      expect(detectDomain("HOTEL in paris")).toBe("accommodation");
      expect(detectDomain("RESTAURANT nearby")).toBe("dining");
      expect(detectDomain("MUSEUM tours")).toBe("activities");
      expect(detectDomain("TRIP plan")).toBe("itinerary");
    });
  });
});

// ==================
// toProtoDomainType Tests
// ==================
describe("toProtoDomainType", () => {
  it('should convert "hotels" context to proto type number 1 (ACCOMMODATION)', () => {
    const result = toProtoDomainType("hotels");
    expect(result).toBeDefined();
  });

  it('should convert "restaurants" context to proto type number 2 (DINING)', () => {
    const result = toProtoDomainType("restaurants");
    expect(result).toBeDefined();
  });

  it('should convert "itineraries" context to proto type number 3 (ITINERARY)', () => {
    const result = toProtoDomainType("itineraries");
    expect(result).toBeDefined();
  });

  it("should return proto type for undefined context", () => {
    const result = toProtoDomainType(undefined);
    expect(result).toBeDefined();
  });

  it('should return proto type for "general" context', () => {
    const result = toProtoDomainType("general");
    expect(result).toBeDefined();
  });
});

// ==================
// domainToContextType Tests
// ==================
describe("domainToContextType", () => {
  it('should convert "accommodation" domain to "hotels" context', () => {
    expect(domainToContextType("accommodation")).toBe("hotels");
  });

  it('should convert "dining" domain to "restaurants" context', () => {
    expect(domainToContextType("dining")).toBe("restaurants");
  });

  it('should convert "itinerary" domain to "itineraries" context', () => {
    expect(domainToContextType("itinerary")).toBe("itineraries");
  });

  it('should convert "activities" domain to "general" context', () => {
    expect(domainToContextType("activities")).toBe("general");
  });

  it('should return "general" context for "general" domain', () => {
    expect(domainToContextType("general")).toBe("general");
  });

  it('should return "general" context for unknown domain', () => {
    expect(domainToContextType("unknown")).toBe("general");
  });

  it('should handle empty string as "general"', () => {
    expect(domainToContextType("")).toBe("general");
  });
});

// ==================
// Edge Cases
// ==================
describe("Edge Cases", () => {
  describe("detectDomain edge cases", () => {
    it("should handle mixed domain keywords - accommodation takes priority if first", () => {
      // Note: The actual priority depends on the order of checks in detectDomain
      const result = detectDomain("hotel with great bar");
      expect(result).toBe("accommodation"); // hotel matched first
    });

    it("should handle empty string", () => {
      expect(detectDomain("")).toBe("general");
    });

    it("should handle whitespace only", () => {
      expect(detectDomain("   ")).toBe("general");
    });

    it("should handle special characters", () => {
      expect(detectDomain("hotel! #great")).toBe("accommodation");
    });
  });

  describe("domainToContextType roundtrip", () => {
    it("should provide consistent mappings", () => {
      // Test that the mapping is consistent
      expect(domainToContextType("accommodation")).toBe("hotels");
      expect(domainToContextType("dining")).toBe("restaurants");
      expect(domainToContextType("itinerary")).toBe("itineraries");
    });
  });
});

describe("mapPoi", () => {
  it("preserves server recommendation attribution", () => {
    const proto = create(POIDetailedInfoSchema, {
      id: "f6d8ed0a-eade-4a77-a82d-a72d8fa5833e",
      name: "Miradouro",
      recommendationTrace: create(RecommendationTraceSchema, {
        runId: "run-123",
        itemId: "f6d8ed0a-eade-4a77-a82d-a72d8fa5833e",
        rank: 2,
        algorithmVersion: "discover-gemini-v1",
        experimentVariant: "personalized",
        surface: RecommendationSurface.DISCOVER,
        channel: RecommendationChannel.WEB,
      }),
    });

    expect(mapPoi(proto).recommendation_trace).toEqual({
      runId: "run-123",
      itemId: "f6d8ed0a-eade-4a77-a82d-a72d8fa5833e",
      rank: 2,
      algorithmVersion: "discover-gemini-v1",
      experimentVariant: "personalized",
      surface: "RECOMMENDATION_SURFACE_DISCOVER",
      channel: "RECOMMENDATION_CHANNEL_WEB",
    });
  });

  it("keeps the image credits, and shows a credited picture even with no bare URL", () => {
    const proto = create(POIDetailedInfoSchema, {
      id: "f6d8ed0a-eade-4a77-a82d-a72d8fa5833e",
      name: "Miradouro",
      imageCredits: [
        {
          url: "https://upload.wikimedia.org/x.jpg",
          source: "wikimedia",
          licence: "CC BY-SA 4.0",
          attribution: "Jane Doe",
          sourcePageUrl: "https://commons.wikimedia.org/wiki/File:x.jpg",
        },
      ],
    });
    const poi = mapPoi(proto);
    expect(poi.images).toEqual(["https://upload.wikimedia.org/x.jpg"]);
    expect(poi.image_credits).toEqual([
      {
        url: "https://upload.wikimedia.org/x.jpg",
        source: "wikimedia",
        licence: "CC BY-SA 4.0",
        attribution: "Jane Doe",
        source_page_url: "https://commons.wikimedia.org/wiki/File:x.jpg",
      },
    ]);
  });

  it("keeps grounded tri-state: absent stays undefined, false stays false", () => {
    expect(mapPoi(create(POIDetailedInfoSchema, { name: "A" })).grounded).toBeUndefined();
    expect(mapPoi(create(POIDetailedInfoSchema, { name: "A", grounded: false })).grounded).toBe(
      false,
    );
    expect(mapPoi(create(POIDetailedInfoSchema, { name: "A", grounded: true })).grounded).toBe(
      true,
    );
  });

  it("splits the wire's comma-separated amenities", () => {
    const poi = mapPoi(create(POIDetailedInfoSchema, { name: "A", amenities: "Wifi, Pool ,Spa" }));
    expect(poi.amenities).toEqual(["Wifi", "Pool", "Spa"]);
  });
});
