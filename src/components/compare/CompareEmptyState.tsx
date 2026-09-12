import { For } from "solid-js";
import { CloudSun, Car, MapPin } from "lucide-solid";
import type { CitySelection } from "./CityAutocomplete";

export interface ComparePreset {
  origin: CitySelection;
  candidates: CitySelection[];
}

/**
 * What the page shows before anyone has compared anything.
 *
 * Everything below the form used to be inside a `Show` on the result, so a
 * first-time visitor met a form and a blank page, with no indication of what
 * they would get back. The presets are one tap because the hardest part of a
 * cold start is thinking of two cities.
 */
export function CompareEmptyState(props: { onPick: (preset: ComparePreset) => void }) {
  const presets: ComparePreset[] = [
    {
      origin: { name: "Porto", country: "Portugal" },
      candidates: [
        { name: "Évora", country: "Portugal" },
        { name: "Beja", country: "Portugal" },
      ],
    },
    {
      origin: { name: "Lisbon", country: "Portugal" },
      candidates: [
        { name: "Sintra", country: "Portugal" },
        { name: "Óbidos", country: "Portugal" },
      ],
    },
    {
      origin: { name: "Madrid", country: "Spain" },
      candidates: [
        { name: "Toledo", country: "Spain" },
        { name: "Segovia", country: "Spain" },
      ],
    },
  ];

  return (
    <section class="loci-card rounded-2xl p-6 flex flex-col gap-5">
      <div>
        <h2 class="font-display text-xl text-foreground">Pick a weekend, get a verdict</h2>
        <p class="text-sm text-muted-foreground mt-1 max-w-lg">
          Two or three cities, side by side for the same window — so the answer is a decision, not a
          wall of prose you have to reason over yourself.
        </p>
      </div>

      <ul class="grid gap-3 sm:grid-cols-3 text-sm">
        <li class="flex items-start gap-2">
          <CloudSun class="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <span class="text-muted-foreground">The forecast for each one, over your dates.</span>
        </li>
        <li class="flex items-start gap-2">
          <Car class="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <span class="text-muted-foreground">How far, how long, and whether both fit.</span>
        </li>
        <li class="flex items-start gap-2">
          <MapPin class="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <span class="text-muted-foreground">What there is to do, and a go/no-go score.</span>
        </li>
      </ul>

      <div class="flex flex-col gap-2">
        <p class="text-sm font-medium">Try one</p>
        <div class="flex flex-wrap gap-2">
          <For each={presets}>
            {(preset) => (
              <button
                type="button"
                class="loci-chip loci-chip--surface text-sm"
                onClick={() => props.onPick(preset)}
              >
                {preset.origin.name} → {preset.candidates.map((c) => c.name).join(" or ")}
              </button>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}

export default CompareEmptyState;
