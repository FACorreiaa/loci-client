import { createMemo, For, Show } from "solid-js";
import { formatPrice } from "~/lib/locale";
import {
  histogram,
  priceBounds,
  priceStep,
  type PriceRange,
  type PriceSort,
} from "~/lib/results/price-filter";
import { RangeSlider } from "~/ui/slider";
import { fieldControlClass } from "~/ui/textfield";
import { cn } from "~/lib/utils";

const BUCKETS = 20;

export type PriceRangeFilterProps = {
  /** Nightly prices of the priced places, in major units. */
  prices: number[];
  currency: string;
  range: PriceRange | null;
  onRangeChange: (range: PriceRange) => void;
  /** Places with no live price, shown in the toggle's label. */
  unpricedCount: number;
  includeUnpriced: boolean;
  onIncludeUnpricedChange: (include: boolean) => void;
  sort: PriceSort;
  onSortChange: (sort: PriceSort) => void;
  loading?: boolean;
  /** The partner could not be reached: say so instead of an empty slider. */
  unavailable?: boolean;
  /** "/ night" for hotels. */
  unitLabel?: string;
};

/**
 * A price histogram over a two-thumb range slider, plus price sorting. The
 * bars show where the prices cluster; the ones outside the range dim, so
 * the user sees what they are cutting before they let go.
 */
export default function PriceRangeFilter(props: PriceRangeFilterProps) {
  const bounds = createMemo(() => priceBounds(props.prices));
  const bars = createMemo(() => {
    const b = bounds();
    return b ? histogram(props.prices, b, BUCKETS) : [];
  });
  const peak = createMemo(() => Math.max(1, ...bars()));
  const current = (): PriceRange => props.range ?? bounds() ?? [0, 0];
  const fmt = (n: number) => formatPrice(n, props.currency);

  const barInRange = (i: number) => {
    const b = bounds();
    if (!b) return false;
    const width = (b[1] - b[0]) / BUCKETS;
    const lo = b[0] + i * width;
    const hi = lo + width;
    const [rLo, rHi] = current();
    return hi > rLo && lo < rHi;
  };

  return (
    <section
      aria-label="Filter by price"
      class="rounded-2xl border border-border bg-card px-4 py-3"
      data-testid="price-range-filter"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold">Price{props.unitLabel ? ` ${props.unitLabel}` : ""}</h2>
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          Sort
          <select
            class={cn(fieldControlClass, "w-auto")}
            value={props.sort}
            onChange={(e) => props.onSortChange(e.currentTarget.value as PriceSort)}
          >
            <option value="relevance">Best match</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>
      </div>

      <Show when={props.loading}>
        <p class="mt-3 text-sm text-muted-foreground" role="status">
          Checking live prices…
        </p>
      </Show>
      <Show when={!props.loading && props.unavailable}>
        <p class="mt-3 text-sm text-muted-foreground" role="status">
          Live prices are unavailable right now.
        </p>
      </Show>
      <Show when={!props.loading && !props.unavailable && !bounds()}>
        <p class="mt-3 text-sm text-muted-foreground" role="status">
          No live prices for these places yet.
        </p>
      </Show>

      <Show when={!props.loading && !props.unavailable && bounds()}>
        {(b) => (
          <>
            <div class="mt-3 flex h-12 items-end gap-px" aria-hidden="true">
              <For each={bars()}>
                {(count, i) => (
                  <div
                    class="flex-1 rounded-t-sm transition-colors"
                    classList={{
                      "bg-primary": barInRange(i()),
                      "bg-muted": !barInRange(i()),
                    }}
                    style={{ height: count === 0 ? "2px" : `${(count / peak()) * 100}%` }}
                    data-testid="price-bar"
                  />
                )}
              </For>
            </div>
            <RangeSlider
              class="mt-1"
              minValue={b()[0]}
              maxValue={b()[1]}
              step={priceStep(b()[1])}
              minStepsBetweenThumbs={1}
              value={[...current()]}
              onChange={(v) => props.onRangeChange([v[0], v[1]] as const)}
              thumbLabels={["Minimum price", "Maximum price"]}
              getValueLabel={(p) => `${fmt(p.values[0])} – ${fmt(p.values[1])}`}
            />
            <div class="mt-2 flex justify-between text-xs text-muted-foreground" aria-live="polite">
              <span data-testid="price-min">{fmt(current()[0])}</span>
              <span data-testid="price-max">
                {fmt(current()[1])}
                {current()[1] >= b()[1] ? "+" : ""}
              </span>
            </div>
          </>
        )}
      </Show>

      <Show when={props.unpricedCount > 0 && !props.loading}>
        <label class="mt-3 flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
          <input
            type="checkbox"
            class="h-4 w-4 min-h-0 shrink-0"
            checked={props.includeUnpriced}
            onChange={(e) => props.onIncludeUnpricedChange(e.currentTarget.checked)}
          />
          Include {props.unpricedCount} {props.unpricedCount === 1 ? "place" : "places"} without a
          live price
        </label>
      </Show>
      <p class="mt-2 text-xs text-muted-foreground">Prices from partners · may change</p>
    </section>
  );
}
