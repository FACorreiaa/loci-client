// @vitest-environment happy-dom
//
// The filter as a person uses it: the histogram, the slider's keyboard, the
// unpriced toggle and the sort select.

import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import PriceRangeFilter from "./PriceRangeFilter";
import type { PriceRange, PriceSort } from "~/lib/results/price-filter";

let host: HTMLDivElement;
let dispose: () => void;

const state = {
  range: null as PriceRange | null,
  include: false,
  sort: "relevance" as PriceSort,
};

const mount = (
  opts: { prices?: number[]; loading?: boolean; unavailable?: boolean; unpriced?: number } = {},
) => {
  dispose = render(() => {
    const [range, setRange] = createSignal<PriceRange | null>(null);
    const [include, setInclude] = createSignal(false);
    const [sort, setSort] = createSignal<PriceSort>("relevance");
    return (
      <PriceRangeFilter
        prices={opts.prices ?? [89, 142, 150, 310]}
        currency="EUR"
        range={range()}
        onRangeChange={(r) => {
          state.range = r;
          setRange(r);
        }}
        unpricedCount={opts.unpriced ?? 2}
        includeUnpriced={include()}
        onIncludeUnpricedChange={(v) => {
          state.include = v;
          setInclude(v);
        }}
        sort={sort()}
        onSortChange={(s) => {
          state.sort = s;
          setSort(s);
        }}
        loading={opts.loading}
        unavailable={opts.unavailable}
        unitLabel="/ night"
      />
    );
  }, host);
};

beforeEach(() => {
  state.range = null;
  state.include = false;
  state.sort = "relevance";
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  dispose?.();
  host.remove();
});

const text = (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";

describe("PriceRangeFilter", () => {
  it("draws a histogram and labels the full range", () => {
    mount();
    expect(host.querySelectorAll('[data-testid="price-bar"]')).toHaveLength(20);
    expect(text("price-min")).toContain("80");
    expect(text("price-max")).toContain("310");
    expect(text("price-max")).toContain("+");
  });

  it("moves the minimum with the keyboard", () => {
    mount();
    const thumbs = [...host.querySelectorAll<HTMLElement>('[role="slider"]')];
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0].getAttribute("aria-label")).toBe("Minimum price");
    thumbs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(state.range?.[0]).toBe(90);
    expect(state.range?.[1]).toBe(310);
  });

  it("toggles places without a price and changes sort", () => {
    mount({ unpriced: 3 });
    const box = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(box.parentElement?.textContent).toContain("3 places without a live price");
    box.click();
    expect(state.include).toBe(true);

    // Typed as an element with a value: the DOM lib's HTMLSelectElement and
    // happy-dom's disagree on remove(), which trips the querySelector bound.
    const select = host.querySelector("select") as unknown as HTMLElement & { value: string };
    select.value = "price_asc";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(state.sort).toBe("price_asc");
  });

  it("says when prices are loading, unavailable or missing", () => {
    mount({ loading: true });
    expect(host.textContent).toContain("Checking live prices");
    dispose();
    host.innerHTML = "";
    mount({ unavailable: true });
    expect(host.textContent).toContain("unavailable right now");
    dispose();
    host.innerHTML = "";
    mount({ prices: [], unpriced: 0 });
    expect(host.textContent).toContain("No live prices");
    expect(host.querySelector('[role="slider"]')).toBeNull();
  });
});
