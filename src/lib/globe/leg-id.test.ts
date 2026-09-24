import { describe, expect, it } from "vitest";
import { legIds, legKey, type LegIdentity } from "./leg-id";

const leg = (from: string, to: string, day?: string, tripId = "t1"): LegIdentity => ({
  tripId,
  fromName: from,
  toName: to,
  fromLat: 38.7,
  fromLon: -9.1,
  toLat: 41.1,
  toLon: -8.6,
  occurredAt: day ? new Date(day) : undefined,
});

describe("legIds", () => {
  it("keys a leg on trip, endpoints and time, not its position", () => {
    const a = leg("Lisbon", "Porto", "2026-05-01T10:00:00Z");
    const b = leg("Porto", "Braga", "2026-05-02T10:00:00Z");
    const before = legIds([a, b]);
    // A new leg arriving first must not change the ids of the others.
    const after = legIds([leg("Faro", "Lisbon", "2026-04-30T10:00:00Z"), a, b]);
    expect(after.slice(1)).toEqual(before);
  });

  it("tells apart the same route on different trips", () => {
    const [x, y] = legIds([
      leg("Lisbon", "Porto", undefined, "t1"),
      leg("Lisbon", "Porto", undefined, "t2"),
    ]);
    expect(x).not.toBe(y);
  });

  it("keeps ids unique when two legs are identical", () => {
    const same = leg("Lisbon", "Porto");
    const ids = legIds([same, same]);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe(legKey(same));
  });

  it("falls back to coordinates when a leg has no names", () => {
    expect(legKey({ ...leg("", ""), tripId: undefined })).toBe("|38.7000,-9.1000|41.1000,-8.6000|");
  });
});
