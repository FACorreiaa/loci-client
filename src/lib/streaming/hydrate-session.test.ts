import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/api/llm", () => ({
  getSessionList: vi.fn(async () => ({ city: { city: "Crete" }, pois: [{ name: "Knossos" }] })),
}));

import { hydrateSession } from "./hydrate-session";
import { loadCompletedSession } from "./completed-sessions";

describe("hydrateSession", () => {
  beforeEach(() => sessionStorage.clear());

  it("builds the page payload from the server and caches it", async () => {
    const data = await hydrateSession("s1", "activities", "activities");
    expect(data).toEqual({
      session_id: "s1",
      general_city_data: { city: "Crete" },
      activities: [{ name: "Knossos" }],
    });
    expect(loadCompletedSession("s1")).toBeTruthy();
  });

  it("returns null for an empty session so the page can re-run", async () => {
    const { getSessionList } = await import("~/lib/api/llm");
    vi.mocked(getSessionList).mockResolvedValueOnce({ city: undefined, pois: [] });
    expect(await hydrateSession("s2", "activities", "activities")).toBeNull();
  });
});
