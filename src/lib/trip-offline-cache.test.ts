// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import type { Trip } from "~/lib/api/trips";
import {
  cacheTripOffline,
  clearOfflineTripCache,
  currentOfflineUserId,
  getCachedTrip,
  listCachedTrips,
  offlineCacheKey,
} from "./trip-offline-cache";

const trip = (id: string, title = id) =>
  ({
    id,
    title,
    cityName: "Lisbon",
    days: [],
    updatedAt: "2026-09-24T10:00:00Z",
    version: 3n,
  }) as unknown as Trip;

const jwt = (payload: object) =>
  `h.${btoa(JSON.stringify(payload)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}.s`;

describe("offline trip cache", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("keeps each account's trips apart", () => {
    cacheTripOffline(trip("a"), "alice");
    cacheTripOffline(trip("b"), "bob");
    expect(listCachedTrips("alice").map((t) => t.id)).toEqual(["a"]);
    expect(listCachedTrips("bob").map((t) => t.id)).toEqual(["b"]);
    expect(getCachedTrip("a", "bob")).toBeUndefined();
    expect(getCachedTrip("a", "alice")?.version).toBe(3n);
  });

  it("reads and writes nothing without a signed-in account", () => {
    cacheTripOffline(trip("a"), null);
    expect(localStorage.length).toBe(0);
    expect(listCachedTrips(null)).toEqual([]);
    expect(getCachedTrip("a", null)).toBeUndefined();
  });

  it("never serves the old unscoped cache, and drops it on the next write", () => {
    localStorage.setItem(
      "loci.offline.trips.v1",
      JSON.stringify({ trips: { x: { id: "x", version: "1" } }, order: ["x"] }),
    );
    expect(getCachedTrip("x", "alice")).toBeUndefined();
    cacheTripOffline(trip("a"), "alice");
    expect(localStorage.getItem("loci.offline.trips.v1")).toBeNull();
  });

  it("clears every account on sign-out, and one account from /offline", () => {
    cacheTripOffline(trip("a"), "alice");
    cacheTripOffline(trip("b"), "bob");
    localStorage.setItem("unrelated", "1");

    clearOfflineTripCache("alice");
    expect(localStorage.getItem(offlineCacheKey("alice"))).toBeNull();
    expect(listCachedTrips("bob")).toHaveLength(1);

    clearOfflineTripCache();
    expect(listCachedTrips("bob")).toEqual([]);
    expect(localStorage.getItem("unrelated")).toBe("1");
  });

  it("takes the account from the stored access token", () => {
    expect(currentOfflineUserId()).toBeNull();
    localStorage.setItem("access_token", jwt({ user_id: "u-123" }));
    expect(currentOfflineUserId()).toBe("u-123");
    localStorage.setItem("access_token", "not-a-jwt");
    expect(currentOfflineUserId()).toBeNull();
  });
});
