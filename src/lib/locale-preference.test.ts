import { describe, expect, it } from "vitest";
import { formatDistance, formatPrice, type Units } from "./locale";

// These mirror exactly what LocaleContext derives from a profile. The context
// itself needs a provider tree to test; the decisions it makes do not, and the
// decisions are where the bugs are.
const unitsOf = (stored?: string): Units => (stored === "imperial" ? "imperial" : "metric");
const currencyOf = (stored?: string): string => stored || "EUR";
const timezoneOf = (stored: string | undefined, guess: string): string => stored || guess;

describe("what the locale context resolves", () => {
  describe("units", () => {
    // Everything Loci measures is metric, so an account that has never chosen
    // is metric — not "unknown", and not the browser's idea.
    it.each([
      [undefined, "metric"],
      ["", "metric"],
      ["metric", "metric"],
      ["imperial", "imperial"],
      // Anything the server would have refused; if it somehow arrives, show
      // the units every distance is already in rather than guessing.
      ["nautical", "metric"],
    ])("stored %j -> %s", (stored, want) => {
      expect(unitsOf(stored as string | undefined)).toBe(want);
    });

    it("changes what a distance reads as", () => {
      expect(formatDistance(13.2, unitsOf("metric"))).toBe("13 km");
      expect(formatDistance(13.2, unitsOf("imperial"))).toBe("8.2 mi");
    });
  });

  describe("currency", () => {
    it.each([
      [undefined, "EUR"],
      ["", "EUR"],
      ["GBP", "GBP"],
    ])("stored %j -> %s", (stored, want) => {
      expect(currencyOf(stored as string | undefined)).toBe(want);
    });

    it("changes the symbol on a price", () => {
      expect(formatPrice(24, currencyOf("GBP"), "en-GB")).toContain("£");
      expect(formatPrice(24, currencyOf(undefined), "de-DE")).toContain("€");
    });
  });

  describe("timezone", () => {
    // The guess fills an unset zone and nothing more. A stored zone wins even
    // when the browser disagrees, which is the whole point of storing one: the
    // guess follows the laptop, and somebody travelling has not moved house.
    it("uses the browser's guess only when nothing is stored", () => {
      expect(timezoneOf(undefined, "Europe/Berlin")).toBe("Europe/Berlin");
      expect(timezoneOf("", "Europe/Berlin")).toBe("Europe/Berlin");
      expect(timezoneOf("Atlantic/Madeira", "Europe/Berlin")).toBe("Atlantic/Madeira");
    });

    it("survives a browser that will not guess", () => {
      expect(timezoneOf(undefined, "")).toBe("");
      expect(timezoneOf("Atlantic/Madeira", "")).toBe("Atlantic/Madeira");
    });
  });
});
