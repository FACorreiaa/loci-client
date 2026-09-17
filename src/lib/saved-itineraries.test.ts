import { describe, expect, it } from "vitest";
import { mergeSavedItineraries, savedItineraryHref } from "./saved-itineraries";
import type { OfflineItinerary } from "./itinerary-offline-store";

const offline = (
  id: string,
  title: string,
  cityName: string,
  savedAt: string,
): OfflineItinerary => ({
  id,
  title,
  cityName,
  payload: {},
  stopCount: 3,
  savedAt,
  sourceUrl: "",
});

const cloud = (id: string, title: string, city: string, created_at: string) => ({
  id,
  title,
  description: "",
  primary_city_id: city,
  created_at,
});

describe("mergeSavedItineraries", () => {
  it("opens an offline copy and marks it on this device", () => {
    const [item] = mergeSavedItineraries(
      [offline("s1", "London in 3 days", "London", "2026-09-10T10:00:00Z")],
      [],
    );
    expect(item.offlineId).toBe("s1");
    expect(item.cloudId).toBeUndefined();
    expect(item.href).toBe("/itinerary?sessionId=s1&cityName=London&domain=itinerary");
  });

  it("keeps a cloud-only bookmark visible but not openable", () => {
    const [item] = mergeSavedItineraries(
      [],
      [cloud("c1", "Porto weekend", "Porto", "2026-09-01T00:00:00Z")],
    );
    expect(item.cloudId).toBe("c1");
    expect(item.offlineId).toBeUndefined();
    expect(item.href).toBeUndefined();
  });

  it("folds a cloud bookmark into the offline copy with the same title and city", () => {
    const items = mergeSavedItineraries(
      [offline("s1", "London in 3 days", "London", "2026-09-10T10:00:00Z")],
      [cloud("c1", "london in 3 days ", "LONDON", "2026-09-09T00:00:00Z")],
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ offlineId: "s1", cloudId: "c1" });
  });

  it("orders newest first across both sources", () => {
    const items = mergeSavedItineraries(
      [offline("s1", "Old", "Porto", "2026-08-01T00:00:00Z")],
      [cloud("c1", "New", "Lisbon", "2026-09-15T00:00:00Z")],
    );
    expect(items.map((i) => i.title)).toEqual(["New", "Old"]);
  });
});

describe("savedItineraryHref", () => {
  it("encodes the city and names the domain", () => {
    expect(savedItineraryHref("abc", "São Paulo")).toBe(
      "/itinerary?sessionId=abc&cityName=S%C3%A3o%20Paulo&domain=itinerary",
    );
  });
});
