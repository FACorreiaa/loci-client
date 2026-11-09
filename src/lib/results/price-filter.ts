// Price filtering and sorting for result lists. Pure: the page owns the
// signals, this owns the rules, so cards and map pins filter identically.

/** A [min, max] price range in major units (euros, not cents), inclusive. */
export type PriceRange = readonly [number, number];

export type PriceSort = "relevance" | "price_asc" | "price_desc";

/** Digits after the decimal point for a currency, from Intl (EUR 2, JPY 0). */
export function currencyDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** Converts an amount in minor units (cents) to major units. */
export function minorToMajor(minor: number, currency: string): number {
  return minor / 10 ** currencyDigits(currency);
}

/**
 * The slider's bounds for a set of prices: rounded out to a step that suits
 * their size, so the handles land on round numbers. Null with no prices.
 */
export function priceBounds(prices: readonly number[]): PriceRange | null {
  const finite = prices.filter((p) => Number.isFinite(p) && p >= 0);
  if (finite.length === 0) return null;
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const step = priceStep(hi);
  const min = Math.floor(lo / step) * step;
  const max = Math.max(min + step, Math.ceil(hi / step) * step);
  return [min, max];
}

/** The slider step for prices up to max: 5 under 100, 10 under 500, else 50. */
export function priceStep(max: number): number {
  if (max < 100) return 5;
  if (max < 500) return 10;
  return 50;
}

/** Counts prices into n equal-width buckets across bounds. */
export function histogram(prices: readonly number[], bounds: PriceRange, n: number): number[] {
  const counts = Array.from({ length: Math.max(1, n) }, () => 0);
  const [min, max] = bounds;
  const width = (max - min) / counts.length;
  for (const p of prices) {
    if (!Number.isFinite(p) || p < min || p > max) continue;
    const i = width > 0 ? Math.min(counts.length - 1, Math.floor((p - min) / width)) : 0;
    counts[i]++;
  }
  return counts;
}

/** True when range is unset or covers all of bounds: nothing is filtered. */
export function isFullRange(range: PriceRange | null, bounds: PriceRange | null): boolean {
  if (!range || !bounds) return true;
  return range[0] <= bounds[0] && range[1] >= bounds[1];
}

/**
 * Keeps items priced within range. Items with no price stay while the range
 * is full (narrowing is an explicit choice to see priced places), and after
 * that only when includeUnpriced is set.
 */
export function applyPriceFilter<T>(
  list: readonly T[],
  priceOf: (item: T) => number | undefined,
  range: PriceRange | null,
  bounds: PriceRange | null,
  includeUnpriced: boolean,
): T[] {
  if (isFullRange(range, bounds)) return [...list];
  const [lo, hi] = range!;
  return list.filter((item) => {
    const p = priceOf(item);
    if (p === undefined) return includeUnpriced;
    return p >= lo && p <= hi;
  });
}

/** Sorts by price, keeping the original order for ties and unpriced items last. */
export function sortByPrice<T>(
  list: readonly T[],
  priceOf: (item: T) => number | undefined,
  sort: PriceSort,
): T[] {
  if (sort === "relevance") return [...list];
  const dir = sort === "price_asc" ? 1 : -1;
  return list
    .map((item, i) => ({ item, i, p: priceOf(item) }))
    .sort((a, b) => {
      if (a.p === undefined && b.p === undefined) return a.i - b.i;
      if (a.p === undefined) return 1;
      if (b.p === undefined) return -1;
      return (a.p - b.p) * dir || a.i - b.i;
    })
    .map((x) => x.item);
}

/**
 * Keeps items whose price tier (1-4) is selected. No selection keeps all;
 * with one, items of unknown tier drop out.
 */
export function filterByTier<T>(
  list: readonly T[],
  tierOf: (item: T) => number | undefined,
  selected: ReadonlySet<number>,
): T[] {
  if (selected.size === 0) return [...list];
  return list.filter((item) => {
    const t = tierOf(item);
    return t !== undefined && selected.has(t);
  });
}

/** "€€" for tier 2 in EUR; "$$" when the currency has no single symbol. */
export function tierLabel(tier: number, currency = "EUR"): string {
  let symbol = "$";
  try {
    const part = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value;
    if (part && [...part].length === 1) symbol = part;
  } catch {
    // keep "$"
  }
  return symbol.repeat(Math.max(1, Math.min(4, tier)));
}
