import { describe, expect, it } from "vitest";
import {
  applyPriceFilter,
  currencyDigits,
  filterByTier,
  histogram,
  isFullRange,
  minorToMajor,
  priceBounds,
  sortByPrice,
  tierLabel,
} from "./price-filter";

type Item = { name: string; price?: number; tier?: number };
const items: Item[] = [
  { name: "a", price: 142 },
  { name: "b" },
  { name: "c", price: 89 },
  { name: "d", price: 310 },
  { name: "e", price: 142 },
];
const priceOf = (i: Item) => i.price;

describe("currency units", () => {
  it("knows minor-unit digits", () => {
    expect(currencyDigits("EUR")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
    expect(currencyDigits("NOPE")).toBe(2);
  });
  it("converts minor to major", () => {
    expect(minorToMajor(14250, "EUR")).toBe(142.5);
    expect(minorToMajor(18000, "JPY")).toBe(18000);
  });
});

describe("priceBounds", () => {
  it("rounds out to a step", () => {
    expect(priceBounds([89, 142, 310])).toEqual([80, 310]);
    expect(priceBounds([42, 61])).toEqual([40, 65]);
    expect(priceBounds([520, 1210])).toEqual([500, 1250]);
  });
  it("is null without prices and never zero-width", () => {
    expect(priceBounds([])).toBeNull();
    expect(priceBounds([100])).toEqual([100, 110]);
  });
});

describe("histogram", () => {
  it("buckets prices, putting the max in the last bucket", () => {
    expect(histogram([80, 90, 150, 310], [80, 320], 4)).toEqual([2, 1, 0, 1]);
  });
});

describe("applyPriceFilter", () => {
  const bounds = [80, 310] as const;
  it("keeps everything at full range, unpriced included", () => {
    expect(applyPriceFilter(items, priceOf, null, bounds, false)).toHaveLength(5);
    expect(applyPriceFilter(items, priceOf, [80, 310], bounds, false)).toHaveLength(5);
  });
  it("narrows to the range and drops unpriced unless asked", () => {
    const names = (l: Item[]) => l.map((i) => i.name);
    expect(names(applyPriceFilter(items, priceOf, [100, 200], bounds, false))).toEqual(["a", "e"]);
    expect(names(applyPriceFilter(items, priceOf, [100, 200], bounds, true))).toEqual([
      "a",
      "b",
      "e",
    ]);
  });
  it("treats a range wider than the bounds as full", () => {
    expect(isFullRange([0, 1000], bounds)).toBe(true);
    expect(isFullRange([81, 310], bounds)).toBe(false);
  });
});

describe("sortByPrice", () => {
  const names = (l: Item[]) => l.map((i) => i.name);
  it("sorts ascending and descending, stable, unpriced last", () => {
    expect(names(sortByPrice(items, priceOf, "price_asc"))).toEqual(["c", "a", "e", "d", "b"]);
    expect(names(sortByPrice(items, priceOf, "price_desc"))).toEqual(["d", "a", "e", "c", "b"]);
    expect(names(sortByPrice(items, priceOf, "relevance"))).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("tiers", () => {
  const list: Item[] = [{ name: "a", tier: 1 }, { name: "b", tier: 3 }, { name: "c" }];
  it("filters by selected tiers, unknown out once filtering", () => {
    expect(filterByTier(list, (i) => i.tier, new Set())).toHaveLength(3);
    expect(filterByTier(list, (i) => i.tier, new Set([3])).map((i) => i.name)).toEqual(["b"]);
  });
  it("labels tiers with the currency symbol", () => {
    expect(tierLabel(2, "EUR")).toBe("€€");
    expect(tierLabel(3, "USD")).toBe("$$$");
    expect(tierLabel(9, "GBP")).toBe("££££");
  });
});
