import { For, Show } from "solid-js";
import { Clock, ShieldCheck } from "lucide-solid";
import { isVerifiedFact, type PlaceFact, type PlaceFactField } from "~/lib/api/place-intelligence";
import { fieldLabel, vocabularyFor } from "~/lib/place-facts/vocabulary";

/**
 * What scouts have confirmed about a place.
 *
 * Contributions were previously invisible: a verified fact reached the
 * generator and nothing else, so a scout's work never showed up anywhere a
 * person could see it. This is the other half of that loop.
 *
 * A fact is shown with its standing rather than as flat truth, because the two
 * are genuinely different claims on the reader's trust — one scout is a report
 * awaiting a second pair of eyes, two or more is something the field guide
 * stands behind.
 */

/** Turns a stored token back into the label the picker offered. */
const valueLabel = (field: PlaceFactField, value: string): string => {
  const vocabulary = vocabularyFor(field);
  if (!vocabulary || vocabulary.kind === "structured") return value;
  // Multi-answer fields are stored one answer per fact, so this is a single
  // token, but splitting keeps it correct for anything stored before the
  // per-answer change.
  return value
    .split(",")
    .map((token) => vocabulary.options.find((o) => o.token === token.trim())?.label ?? token.trim())
    .join(", ");
};

export function PlaceFacts(props: { facts?: PlaceFact[]; class?: string }) {
  const facts = () => props.facts ?? [];

  return (
    <Show when={facts().length > 0}>
      <section class={`rounded-xl border border-border bg-card p-4 ${props.class ?? ""}`}>
        <p class="font-coord text-[10px] uppercase tracking-[0.18em] text-accent">
          Confirmed by scouts
        </p>
        <ul class="mt-3 space-y-2.5">
          <For each={facts()}>
            {(fact) => (
              <li class="flex items-start gap-2.5">
                <Show
                  when={isVerifiedFact(fact)}
                  fallback={<Clock class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                >
                  <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                </Show>
                <div class="min-w-0">
                  <p class="text-sm">
                    <span class="text-muted-foreground">{fieldLabel(fact.field)}:</span>{" "}
                    <span class="font-medium">{valueLabel(fact.field, fact.value)}</span>
                  </p>
                  <p class="mt-0.5 text-[11px] text-muted-foreground">
                    <Show
                      when={isVerifiedFact(fact)}
                      fallback={<>Reported by 1 scout · not yet confirmed</>}
                    >
                      Verified by {fact.contributorCount} scouts
                    </Show>
                  </p>
                </div>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}

export default PlaceFacts;
