// The "try one" presets on /compare, and how one becomes a request.
import { buildCompareInput, type SelectedCity } from "./compare-input";
import { defaultWeekend, type DateWindow } from "./compare-defaults";
import type { CompareWeekendInput } from "./api/compare";

export interface ComparePreset {
  origin: SelectedCity;
  candidates: SelectedCity[];
  /** When the trip is. Absent means the coming weekend, computed when used. */
  window?: DateWindow;
}

// The hardest part of a cold start is thinking of two cities, so each of these
// is one tap: it fills the form and runs the compare in the same click.
export const COMPARE_PRESETS: ComparePreset[] = [
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

/** The request a preset stands for, or null when it is only a prefill. */
export const presetInput = (
  preset: ComparePreset,
  now: Date = new Date(),
): CompareWeekendInput | null =>
  buildCompareInput(preset.origin, preset.candidates, preset.window ?? defaultWeekend(now));
