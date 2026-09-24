import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("mapbox-gl", () => ({ default: {} }));

import { moveCameraTo, startItineraryFlyThrough } from "./camera";
import type { POI } from "./types";

/** Tests run in node, so `window` is stubbed whole — prefersReducedMotion reads it. */
const stubMatchMedia = (reduce: boolean) => {
  const matchMedia = vi.fn((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion: reduce"),
    media: query,
  }));
  vi.stubGlobal("window", { matchMedia });
};

const stubMap = () =>
  ({
    once: vi.fn(),
    flyTo: vi.fn(),
    easeTo: vi.fn(),
    jumpTo: vi.fn(),
    getBearing: vi.fn(() => 0),
  }) as any;

const poi = (name: string, seq: number): POI =>
  ({ id: name, name, latitude: 41.89, longitude: 12.49, seq, category: "" }) as POI;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("startItineraryFlyThrough", () => {
  it("flies between stops normally", () => {
    stubMatchMedia(false);
    const map = stubMap();
    startItineraryFlyThrough(map, [poi("a", 1), poi("b", 2)]);
    vi.advanceTimersByTime(5000);
    expect(map.flyTo).toHaveBeenCalled();
  });

  it("does not start under prefers-reduced-motion", () => {
    stubMatchMedia(true);
    const map = stubMap();
    const cancel = startItineraryFlyThrough(map, [poi("a", 1), poi("b", 2)]);
    vi.advanceTimersByTime(10_000);
    expect(map.flyTo).not.toHaveBeenCalled();
    expect(map.once).not.toHaveBeenCalled();
    expect(() => cancel()).not.toThrow();
  });

  // `essential: true` tells Mapbox to animate even when the OS asks it not to.
  it("does not mark its moves essential", () => {
    stubMatchMedia(false);
    const map = stubMap();
    startItineraryFlyThrough(map, [poi("a", 1)]);
    vi.advanceTimersByTime(1000);
    expect(map.flyTo.mock.calls[0][0].essential).toBeUndefined();
  });
});

describe("moveCameraTo", () => {
  const target = { center: [12.49, 41.89] as [number, number], zoom: 14 };

  it("animates normally", () => {
    stubMatchMedia(false);
    const map = stubMap();
    moveCameraTo(map, target, "fly");
    moveCameraTo(map, target, "ease");
    expect(map.flyTo).toHaveBeenCalledTimes(1);
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(map.jumpTo).not.toHaveBeenCalled();
  });

  it("jumps under prefers-reduced-motion", () => {
    stubMatchMedia(true);
    const map = stubMap();
    moveCameraTo(map, target, "fly");
    moveCameraTo(map, target, "ease");
    expect(map.jumpTo).toHaveBeenCalledTimes(2);
    expect(map.flyTo).not.toHaveBeenCalled();
    expect(map.easeTo).not.toHaveBeenCalled();
  });
});
