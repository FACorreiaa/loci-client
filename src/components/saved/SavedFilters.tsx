import { For } from "solid-js";
import type { SavedCounts } from "~/lib/saved/collect";
import type { SavedView } from "~/lib/saved/types";

const CHIPS: { view: SavedView; label: string }[] = [
  { view: "all", label: "All" },
  { view: "places", label: "Places" },
  { view: "itineraries", label: "Itineraries" },
  { view: "recent", label: "Recent" },
];

interface Props {
  active: SavedView;
  counts: SavedCounts;
  onSelect: (view: SavedView) => void;
}

/** One-tap filters over the same list. The active chip is a URL param, so
 *  the back button and a reload both land where the reader left off. */
export default function SavedFilters(props: Props) {
  return (
    <div class="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter saved items">
      <For each={CHIPS}>
        {(chip) => {
          const selected = () => props.active === chip.view;
          const count = () => props.counts[chip.view];
          return (
            <button
              type="button"
              aria-pressed={selected()}
              onClick={() => props.onSelect(chip.view)}
              class={`rounded-full border px-3 py-1.5 font-coord text-[11px] uppercase tracking-[0.12em] transition-colors ${
                selected()
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {chip.label}
              <span class={selected() ? "ml-1.5 opacity-70" : "ml-1.5 opacity-60"}>{count()}</span>
            </button>
          );
        }}
      </For>
    </div>
  );
}
