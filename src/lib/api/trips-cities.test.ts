import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/connect-transport", () => ({ transport: {} }));

import { toProtoTrip } from "./trips";

describe("saving a multi-city trip", () => {
  it("sends its cities, so an edit does not wipe them", () => {
    const p = toProtoTrip({
      id: "t1",
      userId: "u",
      cityName: "Lisbon",
      title: "Lisbon + Porto",
      constraints: { pace: 0, interests: [] },
      days: [],
      version: 1n,
      createdAt: "",
      updatedAt: "",
      cities: [
        { cityName: "Lisbon", sessionId: "s0", nights: 2, orderIndex: 0 },
        { cityName: "Porto", nights: 1, orderIndex: 1 },
      ],
    } as any);
    expect(p.cities.map((c) => [c.cityName, c.sessionId, c.nights, c.orderIndex])).toEqual([
      ["Lisbon", "s0", 2, 0],
      ["Porto", "", 1, 1],
    ]);
  });
});
