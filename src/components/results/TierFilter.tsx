import { For } from "solid-js";
import { tierLabel } from "~/lib/results/price-filter";

const TIERS = [1, 2, 3, 4] as const;
const NAMES: Record<number, string> = { 1: "Budget", 2: "Moderate", 3: "Pricey", 4: "Splurge" };

/** €–€€€€ toggles for restaurant price bands. None selected shows all. */
export default function TierFilter(props: {
  selected: ReadonlySet<number>;
  onChange: (selected: ReadonlySet<number>) => void;
  currency?: string;
  /** How many places have each tier, to grey out empty ones. */
  counts?: ReadonlyMap<number, number>;
}) {
  const toggle = (tier: number) => {
    const next = new Set(props.selected);
    if (next.has(tier)) next.delete(tier);
    else next.add(tier);
    props.onChange(next);
  };
  return (
    <div
      role="group"
      aria-label="Filter by price"
      class="flex flex-wrap items-center gap-1.5"
      data-testid="tier-filter"
    >
      <span class="mr-1 text-xs text-muted-foreground">Price</span>
      <For each={TIERS}>
        {(tier) => {
          const empty = () => (props.counts ? (props.counts.get(tier) ?? 0) === 0 : false);
          return (
            <button
              type="button"
              aria-pressed={props.selected.has(tier)}
              aria-label={`${NAMES[tier]} (${tierLabel(tier, props.currency)})`}
              disabled={empty() && !props.selected.has(tier)}
              class="rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40"
              classList={{
                "border-primary bg-primary text-primary-foreground": props.selected.has(tier),
                "border-border bg-background text-foreground hover:bg-muted":
                  !props.selected.has(tier),
              }}
              onClick={() => toggle(tier)}
            >
              {tierLabel(tier, props.currency)}
            </button>
          );
        }}
      </For>
    </div>
  );
}
