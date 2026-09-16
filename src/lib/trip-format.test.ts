import { describe, expect, it } from "vitest";
import { formatTripDates, parseTripDate } from "./trip-format";
import type { TripDay } from "~/lib/api/trips";

const day = (date?: string): TripDay => ({ id: date ?? "x", dayNumber: 1, stops: [], date });

// Trip days carry date-only ISO strings ("2026-09-20"). `new Date("2026-09-20")`
// is UTC midnight, which is the previous evening anywhere west of Greenwich, so
// a Lisbon trip read from New York would show the wrong day. Parse as local.
describe("parseTripDate", () => {
  it("reads a date-only string as local midnight", () => {
    const d = parseTripDate("2026-09-20")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(0);
  });

  it("passes a full ISO timestamp through", () => {
    const d = parseTripDate("2026-09-20T15:30:00.000Z")!;
    expect(d.toISOString()).toBe("2026-09-20T15:30:00.000Z");
  });

  it("returns undefined for garbage or empty input", () => {
    expect(parseTripDate("not a date")).toBeUndefined();
    expect(parseTripDate("")).toBeUndefined();
  });
});

describe("formatTripDates", () => {
  it("returns undefined when no day is dated", () => {
    expect(formatTripDates([day(), day()])).toBeUndefined();
  });

  it("keeps the calendar day of date-only strings", () => {
    const s = formatTripDates([day("2026-10-04"), day("2026-10-06")])!;
    expect(s).toContain("4");
    expect(s).toContain("6");
    expect(s).not.toContain("3");
    expect(s).not.toContain("5");
  });

  it("collapses a single day to one date", () => {
    const s = formatTripDates([day("2026-10-04")])!;
    expect(s).toContain("4");
    expect(s).not.toContain("–");
  });
});
