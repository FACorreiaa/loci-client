import { describe, expect, it } from "vitest";
import {
  formatDistance,
  formatPrice,
  groupTimezones,
  KM_PER_MILE,
  supportedTimezones,
} from "./locale";

// The argument is kilometres. That is the entire contract, and getting it wrong
// is not hypothetical here: the server's LLM path wrote metres into a field the
// client read as kilometres, and a POI 1.8 km away was published as 1800.
describe("formatDistance", () => {
  describe("metric", () => {
    it.each([
      [0.4, "400 m"],
      [0.999, "999 m"],
      [1, "1.0 km"],
      [1.85, "1.9 km"],
      [9.94, "9.9 km"],
      [13.2, "13 km"],
      [2000, "2000 km"],
    ])("%j km -> %j", (km, want) => {
      expect(formatDistance(km, "metric")).toBe(want);
    });

    it("is metric by default", () => {
      expect(formatDistance(1.85)).toBe("1.9 km");
    });
  });

  describe("imperial", () => {
    it("uses feet below a tenth of a mile, which is what somebody would say", () => {
      expect(formatDistance(0.1, "imperial")).toBe("328 ft");
    });

    it("converts by the exact definition of a mile", () => {
      // 1.609344 km is exactly one mile.
      expect(formatDistance(KM_PER_MILE, "imperial")).toBe("1.0 mi");
      expect(formatDistance(16.09344, "imperial")).toBe("10 mi");
    });

    it("drops the decimal once the number is large", () => {
      expect(formatDistance(100, "imperial")).toBe("62 mi");
    });
  });

  // A missing distance is not "0 m" — the caller renders nothing.
  it.each([[NaN], [Infinity], [-1]])("returns nothing for %j", (km) => {
    expect(formatDistance(km)).toBe("");
  });
});

describe("formatPrice", () => {
  // Intl output varies by ICU version, so assert what the code decides —
  // the currency actually used — not the exact glyph placement.
  it("uses the currency it is given", () => {
    expect(formatPrice(12, "GBP", "en-GB")).toContain("£");
    expect(formatPrice(12, "USD", "en-US")).toContain("$");
  });

  it("defaults to EUR, which is what prices were hardcoded to", () => {
    expect(formatPrice(12, undefined, "de-DE")).toContain("€");
  });

  // Intl throws on an unknown code rather than degrading. The number with the
  // code beside it is more use than nothing at all.
  it("survives a currency Intl does not know", () => {
    expect(formatPrice(12, "XYZZY")).toBe("12.00 XYZZY");
  });

  it("returns nothing for a non-number", () => {
    expect(formatPrice(NaN)).toBe("");
  });
});

describe("groupTimezones", () => {
  it("groups by region and sorts both levels", () => {
    expect(
      groupTimezones([
        "Europe/Lisbon",
        "Atlantic/Madeira",
        "Europe/Berlin",
        "Atlantic/Azores",
        "UTC",
      ]),
    ).toEqual([
      { region: "Atlantic", zones: ["Atlantic/Azores", "Atlantic/Madeira"] },
      { region: "Europe", zones: ["Europe/Berlin", "Europe/Lisbon"] },
      // A zone with no "/" is still a zone somebody may be in.
      { region: "Other", zones: ["UTC"] },
    ]);
  });

  it("handles an empty list, which is what an old browser returns", () => {
    expect(groupTimezones([])).toEqual([]);
  });
});

describe("supportedTimezones", () => {
  // Intl.supportedValuesOf is not everywhere. The card falls back to free text
  // when it is missing, so this must return a list rather than throw.
  it("returns an array whatever the runtime supports", () => {
    expect(Array.isArray(supportedTimezones())).toBe(true);
  });
});
