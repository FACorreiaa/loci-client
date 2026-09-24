import { describe, expect, it, vi } from "vitest";

// recents.ts pulls in the router (via useAuthGate) and the live transport;
// neither is exercised by fetchRecentInteractions, and the router touches
// `window` at import time.
vi.mock("../auth/useAuthGate", () => ({ useAuthGate: () => () => true }));
vi.mock("../connect-transport", () => ({ transport: {} }));
vi.mock("../api", () => ({ getAuthToken: () => null, authAPI: {} }));

const { fetchRecentInteractions } = await import("./recents");

const signedIn = async () => "user-1";

describe("fetchRecentInteractions", () => {
  it("surfaces an RPC failure instead of reporting no cities", async () => {
    const client = { getRecentInteractions: vi.fn().mockRejectedValue(new Error("unavailable")) };
    await expect(
      fetchRecentInteractions(10, { client: client as never, userId: signedIn }),
    ).rejects.toThrow("unavailable");
  });

  it("is empty, without a call, when nobody is signed in", async () => {
    const client = { getRecentInteractions: vi.fn() };
    const res = await fetchRecentInteractions(10, {
      client: client as never,
      userId: async () => null,
    });
    expect(res.cities).toEqual([]);
    expect(client.getRecentInteractions).not.toHaveBeenCalled();
  });

  it("maps city summaries", async () => {
    const client = {
      getRecentInteractions: vi.fn().mockResolvedValue({
        citySummaries: [
          {
            cityName: "Lisbon",
            cityId: "c1",
            interactionCount: 2,
            latestInteraction: { seconds: 1_800_000_000n },
            recentInteractions: [{ id: "i1", userId: "user-1", description: "tram 28" }],
          },
        ],
        totalCount: 1,
      }),
    };
    const res = await fetchRecentInteractions(10, { client: client as never, userId: signedIn });
    expect(res.total).toBe(1);
    expect(res.cities[0].city_name).toBe("Lisbon");
    expect(res.cities[0].total_interactions).toBe(2);
    expect(res.cities[0].interactions[0].prompt).toBe("tram 28");
  });
});
