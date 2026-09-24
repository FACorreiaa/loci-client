import { For, Show } from "solid-js";
import { AlertTriangle } from "lucide-solid";
import type { StopState } from "~/lib/streaming/multi-city";
import { stopChipLabel } from "./multi-city-view";

/** The cities of a multi-city trip as chips: pick one, or every day. */
export function StopSwitcher(props: {
  stops: StopState[];
  active: number | "all";
  onSelect: (i: number | "all") => void;
  showAll?: boolean;
}) {
  const chip = (on: boolean) =>
    `inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      on
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-foreground hover:border-primary/50"
    }`;
  return (
    <nav class="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Cities in this trip">
      <Show when={props.showAll}>
        <button
          type="button"
          class={chip(props.active === "all")}
          aria-pressed={props.active === "all"}
          onClick={() => props.onSelect("all")}
        >
          All days
        </button>
      </Show>
      <For each={props.stops}>
        {(s, i) => (
          <>
            <Show when={i() > 0}>
              <span aria-hidden="true" class="flex-shrink-0 text-muted-foreground">
                →
              </span>
            </Show>
            <button
              type="button"
              class={chip(props.active === s.index)}
              aria-pressed={props.active === s.index}
              onClick={() => props.onSelect(s.index)}
            >
              {stopChipLabel(s)}
              <Show when={!s.done && !s.error}>
                <span
                  class="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
                  aria-label="still planning"
                />
              </Show>
              <Show when={s.error}>
                <AlertTriangle class="h-3.5 w-3.5" aria-label="this city failed" />
              </Show>
            </button>
          </>
        )}
      </For>
    </nav>
  );
}
