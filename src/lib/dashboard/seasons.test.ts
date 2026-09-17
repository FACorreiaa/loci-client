import { describe, expect, it } from "vitest";
import { SEASONAL_PICKS, monthLabel, picksForMonth, promptFor } from "./seasons";

describe("SEASONAL_PICKS", () => {
  it("gives every month at least four picks", () => {
    for (let m = 1; m <= 12; m++) {
      expect(picksForMonth(m).length, `month ${m}`).toBeGreaterThanOrEqual(4);
    }
  });

  it("has no duplicate city + hook", () => {
    const keys = SEASONAL_PICKS.map((p) => `${p.city}|${p.hook}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only uses months 1–12 and two-letter country codes", () => {
    for (const p of SEASONAL_PICKS) {
      expect(p.months.length).toBeGreaterThan(0);
      for (const m of p.months) expect(m >= 1 && m <= 12, `${p.city} month ${m}`).toBe(true);
      expect(p.countryCode).toMatch(/^[A-Z]{2}$/);
    }
  });
});

describe("picksForMonth", () => {
  it("returns picks in table order for that month only", () => {
    const sept = picksForMonth(9);
    expect(sept.every((p) => p.months.includes(9))).toBe(true);
    const indexes = sept.map((p) => SEASONAL_PICKS.indexOf(p));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it("returns nothing for a month outside 1–12", () => {
    expect(picksForMonth(0)).toEqual([]);
    expect(picksForMonth(13)).toEqual([]);
  });
});

describe("promptFor", () => {
  it("reads as a request the hero box can send as-is", () => {
    expect(
      promptFor({
        city: "Porto",
        countryCode: "PT",
        months: [9],
        hook: "the harvest season",
        emoji: "🍇",
      }),
    ).toBe("Plan 3 days in Porto for the harvest season");
  });

  it("honours a pick's own day count", () => {
    expect(
      promptFor({
        city: "Kyoto",
        countryCode: "JP",
        months: [3],
        hook: "early blossom",
        emoji: "🌸",
        days: 5,
      }),
    ).toBe("Plan 5 days in Kyoto for early blossom");
  });
});

describe("monthLabel", () => {
  it("names the month in English", () => {
    expect(monthLabel(new Date(2026, 8, 17))).toBe("September");
    expect(monthLabel(new Date(2026, 0, 1))).toBe("January");
  });
});
