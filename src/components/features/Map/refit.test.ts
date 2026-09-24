import { describe, expect, it } from "vitest";

import { shouldRefit } from "./refit";

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
const shown = (list: string[], userMoved: boolean) => ({ ids: new Set(list), userMoved });

describe("shouldRefit", () => {
  it("fits the first pins", () => {
    expect(shouldRefit(null, ids("milan", 5))).toBe(true);
    expect(shouldRefit(shown([], true), ids("milan", 5))).toBe(true);
  });

  it("never fits on nothing", () => {
    expect(shouldRefit(shown(ids("milan", 5), false), [])).toBe(false);
  });

  it("follows pins arriving while nobody is steering", () => {
    expect(shouldRefit(shown(ids("milan", 10), false), ids("milan", 10))).toBe(true);
    expect(
      shouldRefit(shown(ids("milan", 10), false), [...ids("milan", 10), ...ids("rome", 10)]),
    ).toBe(true);
  });

  it("leaves the camera alone once the user moved it and more pins arrive", () => {
    const prev = shown(ids("milan", 10), true);
    expect(shouldRefit(prev, ids("milan", 10))).toBe(false);
    expect(shouldRefit(prev, [...ids("milan", 10), ...ids("rome", 10)])).toBe(false);
  });

  it("fits a different set of places even after the user moved", () => {
    const trip = [...ids("milan", 10), ...ids("rome", 10), ...ids("florence", 10)];
    // Another city chosen.
    expect(shouldRefit(shown(ids("milan", 10), true), ids("rome", 10))).toBe(true);
    // "All days" narrowed to one city.
    expect(shouldRefit(shown(trip, true), ids("rome", 10))).toBe(true);
    // One city widened to the whole trip.
    expect(shouldRefit(shown(ids("rome", 10), true), trip)).toBe(true);
  });
});
