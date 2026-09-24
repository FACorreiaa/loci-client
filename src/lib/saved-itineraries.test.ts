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

  it("opens a cloud-only bookmark with no session on its own page", () => {
    const [item] = mergeSavedItineraries(
      [],
      [cloud("c1", "Porto weekend", "Porto", "2026-09-01T00:00:00Z")],
    );
    expect(item.cloudId).toBe("c1");
    expect(item.offlineId).toBeUndefined();
    expect(item.href).toBe("/itinerary/saved/c1");
  });

  it("opens a cloud-only bookmark that kept its session in the planner", () => {
    const [item] = mergeSavedItineraries(
      [],
      [{ ...cloud("c1", "Porto weekend", "", "2026-09-01T00:00:00Z"), session_id: "s9" }],
    );
    expect(item.href).toBe("/itinerary?sessionId=s9&cityName=&domain=itinerary");
  });

  it("folds a bookmark into the device copy of its session even when the titles differ", () => {
    const items = mergeSavedItineraries(
      [offline("s1", "London in 3 days", "London", "2026-09-10T10:00:00Z")],
      [{ ...cloud("c1", "Renamed trip", "", "2026-09-09T00:00:00Z"), session_id: "s1" }],
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ offlineId: "s1", cloudId: "c1" });
  });

  it("folds a cloud bookmark into the offline copy with the same title and city", () => {
    const items = mergeSavedItineraries(
      [offline("s1", "London in 3 days", "London", "2026-09-10T10:00:00Z")],
      [cloud("c1", "london in 3 days ", "LONDON", "2026-09-09T00:00:00Z")],
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ offlineId: "s1", cloudId: "c1" });
  });

  it("folds a cloud bookmark that carries no city into the offline copy", () => {
    // Every bookmark the app has ever written has an empty primary_city_id:
    // the RPC takes a city *name* and persists only an id, which is never sent.
    // Requiring the cities to match meant these never merged, so a single saved
    // itinerary appeared twice.
    const items = mergeSavedItineraries(
      [offline("s1", "Lisbon food walk", "Lisbon", "2026-09-10T10:00:00Z")],
      [cloud("c1", "Lisbon food walk", "", "2026-09-09T00:00:00Z")],
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ offlineId: "s1", cloudId: "c1", cityName: "Lisbon" });
  });

  it("leaves a cloud-only city blank rather than printing an id", () => {
    const [item] = mergeSavedItineraries(
      [],
      [
        cloud(
          "c1",
          "Porto weekend",
          "7f3a1b2c-0000-4000-8000-000000000001",
          "2026-09-01T00:00:00Z",
        ),
      ],
    );
    expect(item.cityName).toBe("");
  });

  it("does not let one offline copy absorb two different bookmarks", () => {
    const items = mergeSavedItineraries(
      [offline("s1", "Porto weekend", "Porto", "2026-09-10T10:00:00Z")],
      [
        cloud("c1", "Porto weekend", "", "2026-09-09T00:00:00Z"),
        cloud("c2", "Porto weekend", "", "2026-09-08T00:00:00Z"),
      ],
    );
    expect(items).toHaveLength(2);
    expect(items.filter((i) => i.cloudId === "c1")).toHaveLength(1);
    expect(items.filter((i) => i.cloudId === "c2")).toHaveLength(1);
  });

  it("still keeps two different cities with the same title apart", () => {
    const items = mergeSavedItineraries(
      [
        offline("s1", "Two days", "Porto", "2026-09-10T10:00:00Z"),
        offline("s2", "Two days", "Lisbon", "2026-09-11T10:00:00Z"),
      ],
      [cloud("c1", "Two days", "Lisbon", "2026-09-09T00:00:00Z")],
    );
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.offlineId === "s2")?.cloudId).toBe("c1");
    expect(items.find((i) => i.offlineId === "s1")?.cloudId).toBeUndefined();
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
