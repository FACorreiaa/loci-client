import { For, Show } from "solid-js";
import { X } from "lucide-solid";
import type { CitySelection } from "./CityAutocomplete";

interface CandidateChipsProps {
  candidates: CitySelection[];
  max: number;
  isPro: boolean;
  onRemove: (index: number) => void;
  onUpgrade?: () => void;
}

/**
 * The chosen candidate cities.
 *
 * This replaces a comma-separated text field, which had two problems beyond
 * being hard to read back: it made "Washington, D.C." impossible to enter, and
 * it hid the plan limit. The server truncates the candidate list to the plan's
 * cap silently, so a free user could type five cities and never learn where
 * three of them went. Showing the cap here is the honest version of that.
 */
export function CandidateChips(props: CandidateChipsProps) {
  const atCap = () => props.candidates.length >= props.max;

  return (
    <div class="flex flex-col gap-2">
      <Show
        when={props.candidates.length > 0}
        fallback={<p class="text-sm text-muted-foreground">Add at least two cities to compare.</p>}
      >
        <ul class="flex flex-wrap gap-2">
          <For each={props.candidates}>
            {(city, i) => (
              <li class="loci-chip inline-flex items-center gap-1.5 text-sm">
                <span>{city.name}</span>
                <Show when={city.country}>
                  <span class="text-muted-foreground text-xs">{city.country}</span>
                </Show>
                <button
                  type="button"
                  class="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${city.name}`}
                  onClick={() => props.onRemove(i())}
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={atCap() && !props.isPro}>
        <p class="text-xs text-muted-foreground">
          Free plans compare {props.max} cities.{" "}
          <button
            type="button"
            class="underline hover:text-foreground"
            onClick={() => props.onUpgrade?.()}
          >
            Upgrade to compare up to 8
          </button>
          .
        </p>
      </Show>
    </div>
  );
}

export default CandidateChips;
