import { describe, expect, it } from "vitest";
import { PACK_THEMES, PACK_THEME_META, monthsLabel, priceLabel, themeLabel } from "./themes";

describe("pack themes", () => {
  it("has metadata for every theme in the vocabulary", () => {
    for (const t of PACK_THEMES) {
      expect(PACK_THEME_META[t]).toBeDefined();
      expect(PACK_THEME_META[t].label).not.toBe("");
    }
  });

  it("falls back to the raw id rather than rendering undefined", () => {
    expect(themeLabel("not_a_theme")).toBe("not_a_theme");
    expect(themeLabel("food")).toBe("Food & wine");
  });
});

describe("monthsLabel", () => {
  it("collapses a run into a range", () => {
    expect(monthsLabel([3, 4, 5])).toBe("Mar–May");
  });

  it("keeps a single month as itself", () => {
    expect(monthsLabel([2])).toBe("Feb");
  });

  // Most winter packs are tagged Nov, Dec, Jan, Feb. Sorted naively that reads
  // "Jan–Feb, Nov–Dec", which describes two seasons instead of one.
  it("reads a winter that wraps the year end as one range", () => {
    expect(monthsLabel([1, 2, 11, 12])).toBe("Nov–Feb");
  });

  it("handles the empty and full cases", () => {
    expect(monthsLabel([])).toBe("Any time");
    expect(monthsLabel([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe("All year");
  });

  it("ignores values that are not months", () => {
    expect(monthsLabel([0, 13, 6])).toBe("Jun");
  });
});

describe("priceLabel", () => {
  it("renders cents as an amount", () => {
    expect(priceLabel(499, "usd")).toBe("$4.99");
    expect(priceLabel(500, "eur")).toBe("€5.00");
  });
});
