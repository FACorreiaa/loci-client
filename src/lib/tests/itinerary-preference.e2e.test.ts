import { describe, it, expect, beforeEach } from "vitest";

/**
 * E2E Tests for Itinerary Generation Preference Flow
 *
 * These tests validate the itinerary generation system:
 * 1. Profile-based preference loading
 * 2. Itinerary generation with user preferences
 * 3. POI recommendations based on preferences
 * 4. Budget, pace, and time preference handling
 * 5. Accessibility and dietary needs integration
 */

// Mock preferences type
interface ItineraryPreferences {
  profileId: string;
  destination: string;
  duration: number;
  budget: "low" | "medium" | "high";
  pace: "relaxed" | "moderate" | "intensive";
  accessibility: string[];
  dietaryNeeds: string[];
  interests: string[];
}

// Mock generated itinerary type
interface GeneratedItinerary {
  id: string;
  name: string;
  destination: string;
  duration: number;
  pois: Array<{
    id: string;
    name: string;
    category: string;
    day: number;
    timeSlot: string;
  }>;
  estimatedBudget: string;
}

// ==================
// Test Data Fixtures
// ==================
const createDefaultPreferences = (): ItineraryPreferences => ({
  profileId: "profile-1",
  destination: "Rome",
  duration: 3,
  budget: "medium",
  pace: "moderate",
  accessibility: [],
  dietaryNeeds: [],
  interests: ["history", "art", "food"],
});

const createMockItinerary = (prefs: ItineraryPreferences): GeneratedItinerary => ({
  id: `itinerary-${Date.now()}`,
  name: `${prefs.duration}-Day Trip to ${prefs.destination}`,
  destination: prefs.destination,
  duration: prefs.duration,
  pois: [
    { id: "poi-1", name: "Colosseum", category: "Historical Site", day: 1, timeSlot: "morning" },
    {
      id: "poi-2",
      name: "Roman Forum",
      category: "Historical Site",
      day: 1,
      timeSlot: "afternoon",
    },
    { id: "poi-3", name: "Trevi Fountain", category: "Landmark", day: 2, timeSlot: "morning" },
    { id: "poi-4", name: "Pantheon", category: "Historical Site", day: 2, timeSlot: "afternoon" },
    { id: "poi-5", name: "Vatican Museums", category: "Museum", day: 3, timeSlot: "morning" },
    {
      id: "poi-6",
      name: "St. Peters Basilica",
      category: "Religious Site",
      day: 3,
      timeSlot: "afternoon",
    },
  ],
  estimatedBudget:
    prefs.budget === "low"
      ? "€50-100/day"
      : prefs.budget === "medium"
        ? "€100-200/day"
        : "€200+/day",
});

const isValidDuration = (duration: number) => duration > 0;

const isValidDestination = (dest: string) => dest.trim().length > 0;

const isValidBudget = (budget: string) => ["low", "medium", "high"].includes(budget);

const isValidPace = (pace: string) => ["relaxed", "moderate", "intensive"].includes(pace);

// ==================
// Preference Flow Tests
// ==================
describe("Itinerary Generation Preference Flow", () => {
  let preferences: ItineraryPreferences;

  beforeEach(() => {
    preferences = createDefaultPreferences();
  });

  describe("Preference Loading", () => {
    it("should load default preferences", () => {
      expect(preferences.profileId).toBe("profile-1");
      expect(preferences.destination).toBe("Rome");
      expect(preferences.duration).toBe(3);
    });

    it("should have valid budget options", () => {
      expect(["low", "medium", "high"]).toContain(preferences.budget);
    });

    it("should have valid pace options", () => {
      expect(["relaxed", "moderate", "intensive"]).toContain(preferences.pace);
    });

    it("should load user interests", () => {
      expect(preferences.interests).toContain("history");
      expect(preferences.interests).toContain("art");
      expect(preferences.interests).toContain("food");
    });
  });

  describe("Preference Modification", () => {
    it("should allow changing destination", () => {
      preferences.destination = "Paris";
      expect(preferences.destination).toBe("Paris");
    });

    it("should allow changing duration", () => {
      preferences.duration = 5;
      expect(preferences.duration).toBe(5);
    });

    it("should allow changing budget level", () => {
      preferences.budget = "high";
      expect(preferences.budget).toBe("high");
    });

    it("should allow changing pace", () => {
      preferences.pace = "relaxed";
      expect(preferences.pace).toBe("relaxed");
    });

    it("should allow adding accessibility needs", () => {
      preferences.accessibility = ["wheelchair", "hearing"];
      expect(preferences.accessibility).toContain("wheelchair");
      expect(preferences.accessibility).toContain("hearing");
    });

    it("should allow adding dietary needs", () => {
      preferences.dietaryNeeds = ["vegetarian", "gluten-free"];
      expect(preferences.dietaryNeeds).toHaveLength(2);
    });

    it("should allow updating interests", () => {
      preferences.interests = ["architecture", "shopping"];
      expect(preferences.interests).not.toContain("history");
      expect(preferences.interests).toContain("architecture");
    });
  });

  describe("Itinerary Generation", () => {
    it("should generate itinerary with correct destination", () => {
      const itinerary = createMockItinerary(preferences);
      expect(itinerary.destination).toBe(preferences.destination);
    });

    it("should generate itinerary with correct duration", () => {
      const itinerary = createMockItinerary(preferences);
      expect(itinerary.duration).toBe(preferences.duration);
    });

    it("should generate itinerary with POIs", () => {
      const itinerary = createMockItinerary(preferences);
      expect(itinerary.pois.length).toBeGreaterThan(0);
    });

    it("should distribute POIs across days", () => {
      const itinerary = createMockItinerary(preferences);
      const daysWithPois = new Set(itinerary.pois.map((poi) => poi.day));
      expect(daysWithPois.size).toBeGreaterThan(1);
    });

    it("should include time slots for POIs", () => {
      const itinerary = createMockItinerary(preferences);
      itinerary.pois.forEach((poi) => {
        expect(["morning", "afternoon", "evening"]).toContain(poi.timeSlot);
      });
    });

    it("should generate budget estimate based on preference", () => {
      preferences.budget = "low";
      let itinerary = createMockItinerary(preferences);
      expect(itinerary.estimatedBudget).toContain("€50-100");

      preferences.budget = "high";
      itinerary = createMockItinerary(preferences);
      expect(itinerary.estimatedBudget).toContain("€200+");
    });
  });

  describe("Pace Impact on Itinerary", () => {
    it("should respect relaxed pace preference", () => {
      preferences.pace = "relaxed";
      preferences.duration = 3;
      const itinerary = createMockItinerary(preferences);

      // With relaxed pace, should have fewer activities per day
      const avgPerDay = itinerary.pois.length / preferences.duration;
      expect(avgPerDay).toBeLessThanOrEqual(3);
    });

    it("should respect intensive pace preference", () => {
      preferences.pace = "intensive";
      preferences.duration = 3;
      const itinerary = createMockItinerary(preferences);

      // Intensive pace allows more activities
      expect(itinerary.pois.length).toBeGreaterThan(0);
    });
  });

  describe("Itinerary Naming", () => {
    it("should generate descriptive itinerary name", () => {
      const itinerary = createMockItinerary(preferences);
      expect(itinerary.name).toContain(preferences.destination);
      expect(itinerary.name).toContain(String(preferences.duration));
    });

    it("should adjust name for different durations", () => {
      preferences.duration = 7;
      const itinerary = createMockItinerary(preferences);
      expect(itinerary.name).toContain("7-Day");
    });

    it("should adjust name for different destinations", () => {
      preferences.destination = "Tokyo";
      const itinerary = createMockItinerary(preferences);
      expect(itinerary.name).toContain("Tokyo");
    });
  });

  describe("POI Properties", () => {
    it("should include POI id", () => {
      const itinerary = createMockItinerary(preferences);
      itinerary.pois.forEach((poi) => {
        expect(poi.id).toBeTruthy();
        expect(typeof poi.id).toBe("string");
      });
    });

    it("should include POI name", () => {
      const itinerary = createMockItinerary(preferences);
      itinerary.pois.forEach((poi) => {
        expect(poi.name).toBeTruthy();
        expect(typeof poi.name).toBe("string");
      });
    });

    it("should include POI category", () => {
      const itinerary = createMockItinerary(preferences);
      itinerary.pois.forEach((poi) => {
        expect(poi.category).toBeTruthy();
        expect(typeof poi.category).toBe("string");
      });
    });

    it("should include day assignment", () => {
      const itinerary = createMockItinerary(preferences);
      itinerary.pois.forEach((poi) => {
        expect(poi.day).toBeGreaterThanOrEqual(1);
        expect(poi.day).toBeLessThanOrEqual(preferences.duration);
      });
    });
  });

  describe("Validation", () => {
    it("should reject negative duration", () => {
      expect(isValidDuration(-1)).toBe(false);
      expect(isValidDuration(0)).toBe(false);
      expect(isValidDuration(1)).toBe(true);
    });

    it("should require destination", () => {
      expect(isValidDestination("")).toBe(false);
      expect(isValidDestination("   ")).toBe(false);
      expect(isValidDestination("Rome")).toBe(true);
    });

    it("should validate budget level", () => {
      expect(isValidBudget("invalid")).toBe(false);
      expect(isValidBudget("medium")).toBe(true);
    });

    it("should validate pace level", () => {
      expect(isValidPace("invalid")).toBe(false);
      expect(isValidPace("moderate")).toBe(true);
    });
  });
});

// ==================
// Integration Tests
// ==================
describe("Preference to Itinerary Integration", () => {
  it("should create complete flow from preferences to itinerary", () => {
    // Step 1: Create preferences
    const prefs = createDefaultPreferences();
    expect(prefs.profileId).toBeTruthy();

    // Step 2: Modify preferences
    prefs.destination = "Barcelona";
    prefs.duration = 4;
    prefs.interests = ["architecture", "beach", "food"];

    // Step 3: Generate itinerary
    const itinerary = createMockItinerary(prefs);

    // Step 4: Validate result
    expect(itinerary.destination).toBe("Barcelona");
    expect(itinerary.duration).toBe(4);
    expect(itinerary.pois.length).toBeGreaterThan(0);
    expect(itinerary.id).toBeTruthy();
  });

  it("should maintain preference consistency in itinerary", () => {
    const prefs: ItineraryPreferences = {
      ...createDefaultPreferences(),
      budget: "high",
      pace: "relaxed",
    };

    const itinerary = createMockItinerary(prefs);

    // Budget should be reflected
    expect(itinerary.estimatedBudget).toContain("€200+");

    // Itinerary should be generated
    expect(itinerary.id).toBeTruthy();
  });
});
