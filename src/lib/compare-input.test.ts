import { describe, it, expect } from "vitest";
import { buildCompareInput, hasCoordinates } from "./compare-input";
import type { DateWindow } from "./compare-defaults";

const window: DateWindow = {
  start: new Date(2026, 8, 19, 0, 0, 0),
  end: new Date(2026, 8, 20, 23, 59, 0),
};

const porto = { name: "Porto", country: "Portugal", lat: 41.14961, lon: -8.61099 };
const evora = { name: "Évora", country: "Portugal" };
const beja = { name: "Beja", country: "Portugal" };

describe("buildCompareInput", () => {
  it("sends the names and the window", () => {
    const input = buildCompareInput({ name: "Porto" }, [evora, beja], window);
    expect(input).not.toBeNull();
    expect(input!.originCity).toBe("Porto");
    expect(input!.candidates).toEqual(["Évora", "Beja"]);
    expect(input!.startDate).toBe(window.start);
    expect(input!.endDate).toBe(window.end);
  });

  it("attaches coordinates when the origin was picked from the list", () => {
    const input = buildCompareInput(porto, [evora, beja], window);
    expect(input!.originLat).toBeCloseTo(41.14961);
    expect(input!.originLon).toBeCloseTo(-8.61099);
  });

  it("omits coordinates for a typed origin", () => {
    const input = buildCompareInput({ name: "Porto" }, [evora, beja], window);
    expect(input!.originLat).toBeUndefined();
    expect(input!.originLon).toBeUndefined();
  });

  // The server reads a non-zero latitude *or* longitude as "a position was
  // supplied" and stops resolving the name. Half a pair would therefore compare
  // against a point on the equator rather than the city someone asked for.
  it("omits coordinates when only one of the pair is present", () => {
    const half = buildCompareInput({ name: "Porto", lat: 41.1 }, [evora, beja], window);
    expect(half!.originLat).toBeUndefined();
    expect(half!.originLon).toBeUndefined();

    const other = buildCompareInput({ name: "Porto", lon: -8.6 }, [evora, beja], window);
    expect(other!.originLat).toBeUndefined();
  });

  it("omits coordinates that are not real numbers", () => {
    const input = buildCompareInput(
      { name: "Porto", lat: Number.NaN, lon: Number.POSITIVE_INFINITY },
      [evora, beja],
      window,
    );
    expect(input!.originLat).toBeUndefined();
    expect(input!.originLon).toBeUndefined();
  });

  // A genuine coordinate of 0 is the Gulf of Guinea, but it is also what an
  // unset field looks like. Passing it through is correct here; the server's
  // own short-circuit is what decides.
  it("passes through a zero coordinate pair", () => {
    const input = buildCompareInput({ name: "Null Island", lat: 0, lon: 0 }, [evora, beja], window);
    expect(input!.originLat).toBe(0);
    expect(input!.originLon).toBe(0);
  });

  it("refuses an incomplete form rather than sending a request that must fail", () => {
    expect(buildCompareInput(null, [evora, beja], window)).toBeNull();
    expect(buildCompareInput({ name: "   " }, [evora, beja], window)).toBeNull();
    expect(buildCompareInput(porto, [evora], window)).toBeNull();
    expect(buildCompareInput(porto, [], window)).toBeNull();
  });

  it("refuses a window that ends before it starts", () => {
    const backwards: DateWindow = { start: window.end, end: window.start };
    expect(buildCompareInput(porto, [evora, beja], backwards)).toBeNull();
  });

  it("refuses a window with no duration", () => {
    const instant: DateWindow = { start: window.start, end: window.start };
    expect(buildCompareInput(porto, [evora, beja], instant)).toBeNull();
  });

  it("trims names and drops blanks", () => {
    const input = buildCompareInput(
      { name: "  Porto  " },
      [{ name: "  Évora " }, { name: "Beja" }],
      window,
    );
    expect(input!.originCity).toBe("Porto");
    expect(input!.candidates).toEqual(["Évora", "Beja"]);
  });

  it("refuses when trimming leaves fewer than two candidates", () => {
    expect(buildCompareInput(porto, [{ name: "Évora" }, { name: "   " }], window)).toBeNull();
  });
});

describe("hasCoordinates", () => {
  it("needs both halves", () => {
    expect(hasCoordinates(porto)).toBe(true);
    expect(hasCoordinates({ name: "x", lat: 1 })).toBe(false);
    expect(hasCoordinates({ name: "x", lon: 1 })).toBe(false);
    expect(hasCoordinates({ name: "x" })).toBe(false);
  });
});
