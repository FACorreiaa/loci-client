import { createMemo, createSignal, Show } from "solid-js";
import { Loader2, GitCompare } from "lucide-solid";
import { Button } from "~/ui/button";
import { useEntitlements } from "~/lib/api/entitlements";
import { PLAN_GATING_ENABLED, isProPlan } from "~/lib/subscription";
import { defaultWeekend, type DateWindow } from "~/lib/compare-defaults";
import type { CompareWeekendInput } from "~/lib/api/compare";
import { buildCompareInput } from "~/lib/compare-input";
import { CityAutocomplete, type CitySelection } from "./CityAutocomplete";
import { CandidateChips } from "./CandidateChips";
import { DateRangeField } from "./DateRangeField";

// Mirrors FreeMaxCandidates / ProMaxCandidates on the server. The server is
// still the authority and truncates; this exists so the limit is visible before
// someone runs into it rather than after.
const FREE_MAX_CANDIDATES = 2;
const PRO_MAX_CANDIDATES = 8;

interface CompareFormProps {
  pending: boolean;
  onSubmit: (input: CompareWeekendInput) => void;
  onUpgrade?: () => void;
  /** Prefills from an example or a "did you mean" suggestion. */
  initialOrigin?: CitySelection | null;
  initialCandidates?: CitySelection[];
  /** The window a preset or a rerun was sent with, so the form shows what ran. */
  initialWindow?: DateWindow;
}

export function CompareForm(props: CompareFormProps) {
  const entitlements = useEntitlements();
  // Guarded: `.data` suspends while pending, up to the router-level <Suspense>.
  // With gating off nobody waits for the entitlements query; with it on, an
  // unresolved query must not read as Pro.
  const isPro = () =>
    PLAN_GATING_ENABLED ? entitlements.isSuccess && isProPlan(entitlements.data?.plan) : true;
  const maxCandidates = () => (isPro() ? PRO_MAX_CANDIDATES : FREE_MAX_CANDIDATES);

  const [origin, setOrigin] = createSignal<CitySelection | null>(props.initialOrigin ?? null);
  const [candidates, setCandidates] = createSignal<CitySelection[]>(props.initialCandidates ?? []);
  // Computed at construction rather than at module scope, so a page left open
  // over a weekend does not go on offering the one that has passed.
  const [window, setWindow] = createSignal<DateWindow>(props.initialWindow ?? defaultWeekend());

  const enoughCandidates = () => candidates().length >= 2;
  const windowValid = () => window().end > window().start;
  const canSubmit = () =>
    Boolean(origin()) && enoughCandidates() && windowValid() && !props.pending;

  const addCandidate = (city: CitySelection) => {
    setCandidates((current) => {
      if (current.length >= maxCandidates()) return current;
      const already = current.some((c) => c.name.toLowerCase() === city.name.toLowerCase());
      return already ? current : [...current, city];
    });
  };

  const excluded = createMemo(() => {
    const names = candidates().map((c) => c.name);
    const o = origin()?.name;
    // The origin is excluded too: comparing a city with itself is not a
    // question anyone is asking.
    return o ? [...names, o] : names;
  });

  const submit = () => {
    if (props.pending) return;
    const input = buildCompareInput(origin(), candidates(), window());
    if (input) props.onSubmit(input);
  };

  return (
    <form
      class="loci-card rounded-2xl p-5 mb-8 flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <CityAutocomplete
          label="From"
          placeholder="Porto"
          value={origin()}
          excludeNames={candidates().map((c) => c.name)}
          onSelect={setOrigin}
        />

        <div class="flex flex-col gap-2">
          <CityAutocomplete
            label="Compare"
            placeholder={candidates().length >= maxCandidates() ? "Limit reached" : "Évora"}
            excludeNames={excluded()}
            disabled={candidates().length >= maxCandidates()}
            clearOnSelect
            onSelect={addCandidate}
          />
          <CandidateChips
            candidates={candidates()}
            max={maxCandidates()}
            isPro={isPro()}
            onRemove={(i) => setCandidates((c) => c.filter((_, idx) => idx !== i))}
            onUpgrade={props.onUpgrade}
          />
        </div>
      </div>

      <DateRangeField window={window()} onChange={setWindow} />

      <div class="flex flex-col gap-2">
        {/* The kit's primary button, not `.loci-hero__action`: that class paints
            in --hero-foreground, which is near-white, so on this card the one
            action on the page was white on white and read as missing. */}
        <Button type="submit" size="lg" class="w-full gap-2" disabled={!canSubmit()}>
          <Show
            when={!props.pending}
            fallback={
              <>
                <Loader2 class="w-4 h-4 animate-spin" />
                Comparing…
              </>
            }
          >
            <GitCompare class="w-4 h-4" />
            Compare weekend
          </Show>
        </Button>

        {/* The old form validated silently: fewer than two cities simply did
            nothing when the button was pressed, which reads as a broken button.
            It has to be genuinely readable — muted text at the smallest size is
            how the original dead end stayed invisible. */}
        <Show when={!props.pending && !canSubmit()}>
          <p class="text-sm text-foreground/80 text-center">
            <Show
              when={!origin()}
              fallback={
                <Show
                  when={!enoughCandidates()}
                  fallback="Choose an end date after the start date."
                >
                  Add {2 - candidates().length} more {candidates().length === 1 ? "city" : "cities"}{" "}
                  to compare.
                </Show>
              }
            >
              Choose where you are starting from.
            </Show>
          </p>
        </Show>
      </div>
    </form>
  );
}

export default CompareForm;
