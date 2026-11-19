import { describe, expect, it, vi } from "vitest";
import { fetchSharedTripMeta, sharedTripImageUrl, sharedTripMeta } from "./shared-meta";

describe("sharedTripMeta", () => {
  it("summarises days, cities, stops and the owner", () => {
    const m = sharedTripMeta({
      title: "Lisbon long weekend",
      cityName: "Lisbon",
      owner: { displayName: "Ana Sousa", username: "ana" },
      days: [
        { stops: [{ name: "Belém Tower" }, { name: "Pastéis de Belém" }] },
        { cityName: "Sintra", stops: [{ name: "Pena Palace" }, { name: "Quinta da Regaleira" }] },
      ],
    });
    expect(m).toEqual({
      title: "Lisbon long weekend — by Ana Sousa",
      description:
        "2 days · Lisbon, Sintra · 4 stops. Belém Tower · Pastéis de Belém · Pena Palace",
    });
  });

  it("says how many stops were found on the map, and nothing when none were", () => {
    const checked = { check: { status: "STOP_CHECK_STATUS_CHECKED" } };
    const missing = { check: { status: "STOP_CHECK_STATUS_NOT_FOUND" } };
    const withChecks = sharedTripMeta({
      title: "Porto",
      days: [{ stops: [{ name: "A", ...checked }, { name: "B", ...checked }, { ...missing }, {}] }],
    });
    expect(withChecks?.description).toBe("1 day · 4 stops · 2 of 3 checked against the map. A · B");

    const noneFound = sharedTripMeta({ title: "Porto", days: [{ stops: [{ ...missing }] }] });
    expect(noneFound?.description).toBe("1 day · 1 stop");
  });

  it("is undefined without a trip", () => {
    expect(sharedTripMeta(undefined)).toBeUndefined();
    expect(sharedTripMeta({})).toBeUndefined();
  });
});

describe("sharedTripImageUrl", () => {
  it("points at the API's image for the share code", () => {
    expect(sharedTripImageUrl("https://api.lociai.fyi", "ab c")).toBe(
      "https://api.lociai.fyi/trip-img/ab%20c/og.png",
    );
  });
});

describe("fetchSharedTripMeta", () => {
  it("posts the share code with the Connect JSON protocol", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ title: "Porto", days: [{ stops: [] }] }));
    const m = await fetchSharedTripMeta("https://api.test", "abc123", fetchImpl);
    expect(m?.title).toBe("Porto");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/loci.trip.TripService/GetSharedTrip");
    expect(JSON.parse(init.body as string)).toEqual({ shareCode: "abc123" });
    expect((init.headers as Record<string, string>)["Connect-Protocol-Version"]).toBe("1");
  });

  it("swallows errors and non-OK answers", async () => {
    const notFound = vi.fn(async () => new Response("{}", { status: 404 }));
    expect(await fetchSharedTripMeta("x", "c", notFound as typeof fetch)).toBeUndefined();
    const boom = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await fetchSharedTripMeta("x", "c", boom as typeof fetch)).toBeUndefined();
  });
});
