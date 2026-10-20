import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import type { RankedPlaceView, VerdictName } from "~/lib/ranking/flow";

const DOT: Record<VerdictName, string> = {
  loved: "bg-accent",
  fine: "bg-muted-foreground/60",
  not_for_me: "bg-destructive/70",
};

const VERDICT_LABEL: Record<VerdictName, string> = {
  loved: "Loved",
  fine: "Fine",
  not_for_me: "Not for me",
};

/** One city's ranked places: rank, name, verdict, 0–10 score. */
export default function RankedList(props: { title: string; places: RankedPlaceView[] }) {
  return (
    <Show when={props.places.length > 0}>
      <section class="rounded-2xl border border-border bg-card p-5">
        <h2 class="mb-3 text-lg font-semibold text-foreground">{props.title}</h2>
        <ol class="divide-y divide-border">
          <For each={props.places}>
            {(p) => (
              <li class="flex items-center gap-3 py-2">
                <span class="w-6 text-right text-sm font-semibold tabular-nums text-muted-foreground">
                  {p.rank}
                </span>
                <span
                  class={`h-2 w-2 shrink-0 rounded-full ${DOT[p.verdict]}`}
                  title={VERDICT_LABEL[p.verdict]}
                  aria-label={VERDICT_LABEL[p.verdict]}
                />
                <A
                  href={`/places/${encodeURIComponent(p.poiId)}`}
                  class="min-w-0 flex-1 truncate text-sm text-foreground hover:underline"
                >
                  {p.name}
                </A>
                <span class="text-sm font-semibold tabular-nums text-foreground">
                  {p.score.toFixed(1)}
                </span>
              </li>
            )}
          </For>
        </ol>
      </section>
    </Show>
  );
}
