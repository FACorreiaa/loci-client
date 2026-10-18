/**
 * Unit tests for itinerary-offline-store.
 *
 * IndexedDB is not available in the Node test environment, so we use
 * fake-indexeddb to provide a full in-memory implementation.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveItineraryOffline,
  getOfflineItinerary,
  updateItineraryMeta,
  listOfflineItineraries,
  clearOfflineItineraries,
  type OfflineItinerary,
} from "./itinerary-offline-store";

const base: OfflineItinerary = {
  id: "test-session-1",
  cityName: "Funchal",
  title: "Funchal Weekend",
  payload: { general_city_data: { city: "Funchal" } },
  stopCount: 4,
  savedAt: new Date("2026-10-01T10:00:00Z").toISOString(),
  sourceUrl: "https://loci.app/itinerary?sessionId=test-session-1",
};

beforeEach(async () => {
  await clearOfflineItineraries();
});

describe("saveItineraryOffline / getOfflineItinerary", () => {
  it("stores and retrieves a record", async () => {
    await saveItineraryOffline(base);
    const result = await getOfflineItinerary(base.id);
    expect(result).toBeDefined();
    expect(result!.title).toBe("Funchal Weekend");
    expect(result!.cityName).toBe("Funchal");
  });

  it("returns undefined for an unknown id", async () => {
    const result = await getOfflineItinerary("does-not-exist");
    expect(result).toBeUndefined();
  });
});

describe("updateItineraryMeta", () => {
  it("adds tripStartDate to an existing record without changing payload", async () => {
    await saveItineraryOffline(base);
    await updateItineraryMeta(base.id, { tripStartDate: "2026-10-08" });

    const result = await getOfflineItinerary(base.id);
    expect(result!.tripStartDate).toBe("2026-10-08");
    // Payload must be unchanged
    expect(result!.payload).toEqual(base.payload);
    expect(result!.stopCount).toBe(4);
  });

  it("adds stopNotes to an existing record", async () => {
    await saveItineraryOffline(base);
    const notes = { "Café do Museu": "Book in advance", "Cabo Girão": "Morning is best" };
    await updateItineraryMeta(base.id, { stopNotes: notes });

    const result = await getOfflineItinerary(base.id);
    expect(result!.stopNotes).toEqual(notes);
  });

  it("adds stopOrder to an existing record", async () => {
    await saveItineraryOffline(base);
    const order = ["Cabo Girão", "Monte Palace", "Café do Museu", "Old Town"];
    await updateItineraryMeta(base.id, { stopOrder: order });

    const result = await getOfflineItinerary(base.id);
    expect(result!.stopOrder).toEqual(order);
  });

  it("merges multiple patch fields in one call", async () => {
    await saveItineraryOffline(base);
    await updateItineraryMeta(base.id, {
      tripStartDate: "2026-10-10",
      stopNotes: { "Sé Cathedral": "Entry is free" },
      stopOrder: ["Sé Cathedral"],
    });

    const result = await getOfflineItinerary(base.id);
    expect(result!.tripStartDate).toBe("2026-10-10");
    expect(result!.stopNotes).toEqual({ "Sé Cathedral": "Entry is free" });
    expect(result!.stopOrder).toEqual(["Sé Cathedral"]);
  });

  it("subsequent patch overwrites the previous value", async () => {
    await saveItineraryOffline(base);
    await updateItineraryMeta(base.id, { tripStartDate: "2026-10-08" });
    await updateItineraryMeta(base.id, { tripStartDate: "2026-11-01" });

    const result = await getOfflineItinerary(base.id);
    expect(result!.tripStartDate).toBe("2026-11-01");
  });

  it("resolves silently when the record does not exist", async () => {
    // Should not throw
    await expect(
      updateItineraryMeta("nonexistent-id", { tripStartDate: "2026-10-08" }),
    ).resolves.toBeUndefined();
  });

  it("resolves silently when called with an empty id", async () => {
    await expect(updateItineraryMeta("", { tripStartDate: "2026-10-08" })).resolves.toBeUndefined();
  });
});

describe("listOfflineItineraries", () => {
  it("returns records sorted newest-first", async () => {
    await saveItineraryOffline({ ...base, id: "old", savedAt: "2026-09-01T00:00:00Z" });
    await saveItineraryOffline({ ...base, id: "new", savedAt: "2026-10-01T00:00:00Z" });

    const list = await listOfflineItineraries();
    expect(list[0].id).toBe("new");
    expect(list[1].id).toBe("old");
  });
});
