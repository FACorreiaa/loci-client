import { createSignal, For, Show } from "solid-js";
import { ArrowDown, ArrowUp, Minus, Plus, X } from "lucide-solid";
import { Button } from "~/ui/button";
import { MAX_STOPS, type StopInput } from "./multi-city-view";
import { addStop, moveStop, removeStop, setNights } from "./stop-builder";

/**
 * Several cities in one trip: add them, give each its nights, put them in
 * order (buttons, not drag, so it works from a keyboard), or let Loci order
 * them. Typing "Lisbon for 3 days then Porto for 2" does the same from the
 * search box; this is for people who would rather not.
 */
export function StopBuilder(props: {
  onPlan: (stops: StopInput[], suggestOrder: boolean) => void;
}) {
  const [stops, setStops] = createSignal<StopInput[]>([]);
  const [draft, setDraft] = createSignal("");
  const [suggest, setSuggest] = createSignal(false);

  const add = (e?: Event) => {
    e?.preventDefault();
    setStops((l) => addStop(l, draft()));
    setDraft("");
  };

  const iconBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40";

  return (
    <details class="mt-4 rounded-xl border border-border/70 bg-card/60 px-4 py-3">
      <summary class="cursor-pointer text-sm font-medium text-foreground">
        Plan several cities
      </summary>
      <form class="mt-3 flex gap-2" onSubmit={add}>
        <input
          type="text"
          placeholder={stops().length >= MAX_STOPS ? `Up to ${MAX_STOPS} cities` : "Add a city"}
          value={draft()}
          disabled={stops().length >= MAX_STOPS}
          onInput={(e) => setDraft(e.currentTarget.value)}
          class="flex-1 rounded-xl border-2 border-border bg-card/95 px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring"
          aria-label="City to add"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={!draft().trim() || stops().length >= MAX_STOPS}
        >
          Add
        </Button>
      </form>

      <Show when={stops().length > 0}>
        <ol class="mt-3 space-y-2">
          <For each={stops()}>
            {(s, i) => (
              <li class="flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2 text-sm">
                <span class="w-5 text-muted-foreground tabular-nums">{i() + 1}.</span>
                <span class="flex-1 font-medium">{s.cityName}</span>
                <button
                  type="button"
                  class={iconBtn}
                  aria-label={`Fewer nights in ${s.cityName}`}
                  onClick={() => setStops((l) => setNights(l, i(), (s.nights ?? 2) - 1))}
                >
                  <Minus class="h-3.5 w-3.5" />
                </button>
                <span class="w-16 text-center tabular-nums">
                  {s.nights ?? 2} night{(s.nights ?? 2) === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  class={iconBtn}
                  aria-label={`More nights in ${s.cityName}`}
                  onClick={() => setStops((l) => setNights(l, i(), (s.nights ?? 2) + 1))}
                >
                  <Plus class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class={iconBtn}
                  aria-label={`Move ${s.cityName} earlier`}
                  disabled={i() === 0}
                  onClick={() => setStops((l) => moveStop(l, i(), i() - 1))}
                >
                  <ArrowUp class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class={iconBtn}
                  aria-label={`Move ${s.cityName} later`}
                  disabled={i() === stops().length - 1}
                  onClick={() => setStops((l) => moveStop(l, i(), i() + 1))}
                >
                  <ArrowDown class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class={iconBtn}
                  aria-label={`Remove ${s.cityName}`}
                  onClick={() => setStops((l) => removeStop(l, i()))}
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </li>
            )}
          </For>
        </ol>
      </Show>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={suggest()}
            onChange={(e) => setSuggest(e.currentTarget.checked)}
          />
          Suggest the best order
        </label>
        <Button
          type="button"
          disabled={stops().length < 2}
          onClick={() => props.onPlan(stops(), suggest())}
        >
          Plan trip
        </Button>
      </div>
      <p class="mt-2 text-xs text-muted-foreground">
        Travel between cities is an estimate — check times before you book.
      </p>
    </details>
  );
}
