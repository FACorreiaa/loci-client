import { For, Match, Show, Switch, createSignal } from "solid-js";
import { X } from "lucide-solid";
import { useComparePlaces, useRatePlace } from "~/lib/api/ranking";
import {
  VERDICTS,
  afterAnswer,
  comparePrompt,
  doneMessage,
  howWasItPrompt,
  type HowWasItState,
  type VerdictName,
} from "~/lib/ranking/flow";

export interface HowWasItProps {
  poiId: string;
  name: string;
  cityName: string;
  category?: string;
  onDone?: () => void;
}

/**
 * "How was it?" after a visit: a verdict, then a few "better or worse than Y?"
 * answers that place the visit in the traveller's ranked list for the city.
 * Every answer also teaches their taste. Skip ends it early; the place stays at
 * the bottom of its bucket.
 */
export default function HowWasIt(props: HowWasItProps) {
  const rate = useRatePlace();
  const compare = useComparePlaces();
  const [state, setState] = createSignal<HowWasItState>({ step: "verdict" });
  const [error, setError] = createSignal<string>();
  const busy = () => rate.isPending || compare.isPending;

  const chooseVerdict = async (verdict: VerdictName) => {
    setError(undefined);
    try {
      const step = await rate.mutateAsync({
        poiId: props.poiId,
        name: props.name,
        cityName: props.cityName,
        category: props.category,
        verdict,
      });
      setState(afterAnswer(step.place, step.next));
    } catch {
      setError("Couldn't save that — try again.");
    }
  };

  const answer = async (better: boolean) => {
    const s = state();
    if (s.step !== "compare") return;
    setError(undefined);
    try {
      const step = await compare.mutateAsync({
        poiId: props.poiId,
        otherPoiId: s.other.poiId,
        better,
      });
      setState(afterAnswer(step.place, step.next));
    } catch {
      setError("Couldn't save that — try again.");
    }
  };

  const button =
    "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60";

  return (
    <section
      class="rounded-2xl border border-border bg-card p-4"
      aria-live="polite"
      onClick={(e) => e.stopPropagation()}
    >
      <div class="flex items-start justify-between gap-3">
        <Switch>
          <Match when={state().step === "verdict"}>
            <p class="font-semibold text-foreground">{howWasItPrompt(props.name)}</p>
          </Match>
          <Match when={state().step === "compare" && state()}>
            {(s) => (
              <p class="font-semibold text-foreground">
                {comparePrompt((s() as Extract<HowWasItState, { step: "compare" }>).other.name)}
              </p>
            )}
          </Match>
          <Match when={state().step === "done" && state()}>
            {(s) => (
              <p class="font-semibold text-foreground">
                {doneMessage((s() as Extract<HowWasItState, { step: "done" }>).place)}
              </p>
            )}
          </Match>
        </Switch>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground"
          aria-label="Close"
          onClick={() => props.onDone?.()}
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <Switch>
          <Match when={state().step === "verdict"}>
            <For each={VERDICTS}>
              {(v) => (
                <button
                  type="button"
                  class={button}
                  disabled={busy()}
                  onClick={() => void chooseVerdict(v.verdict)}
                >
                  {v.label}
                </button>
              )}
            </For>
          </Match>
          <Match when={state().step === "compare"}>
            <button
              type="button"
              class={button}
              disabled={busy()}
              onClick={() => void answer(true)}
            >
              Better
            </button>
            <button
              type="button"
              class={button}
              disabled={busy()}
              onClick={() => void answer(false)}
            >
              Worse
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => props.onDone?.()}
            >
              Skip
            </button>
          </Match>
          <Match when={state().step === "done"}>
            <button type="button" class={button} onClick={() => props.onDone?.()}>
              Done
            </button>
          </Match>
        </Switch>
      </div>
      <Show when={error()}>
        <p class="mt-2 text-xs text-destructive">{error()}</p>
      </Show>
    </section>
  );
}
