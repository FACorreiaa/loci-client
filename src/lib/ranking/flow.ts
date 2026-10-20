// The "How was it?" flow and the ranked lists it builds. Kept free of Solid so
// the steps can be tested without rendering.
//
// A verdict drops the place into a bucket (Loved / Fine / Not for me); while
// the server sends a comparison, the traveller answers "better or worse than
// Y?", and each answer halves where the place can sit. No comparison means it
// is placed. Skipping at any point leaves it at the bottom of its bucket.

export type VerdictName = "loved" | "fine" | "not_for_me";

export const VERDICTS: { verdict: VerdictName; label: string }[] = [
  { verdict: "loved", label: "Loved" },
  { verdict: "fine", label: "Fine" },
  { verdict: "not_for_me", label: "Not for me" },
];

export interface RankedPlaceView {
  poiId: string;
  name: string;
  category: string;
  cityName: string;
  verdict: VerdictName;
  /** 1-based within the city. */
  rank: number;
  /** 0–10, one decimal. */
  score: number;
  /** Comparisons unfinished. */
  pending: boolean;
  updatedAt?: Date;
}

export interface ComparisonView {
  poiId: string;
  name: string;
}

export type HowWasItState =
  | { step: "verdict" }
  | { step: "compare"; place: RankedPlaceView; other: ComparisonView }
  | { step: "done"; place: RankedPlaceView };

export function afterAnswer(
  place: RankedPlaceView,
  next: ComparisonView | undefined,
): HowWasItState {
  return next ? { step: "compare", place, other: next } : { step: "done", place };
}

export const howWasItPrompt = (name: string) => `How was ${name}?`;
export const comparePrompt = (otherName: string) => `Better or worse than ${otherName}?`;
export const doneMessage = (place: RankedPlaceView) =>
  `#${place.rank} in your ${place.cityName} list`;

/** How many places a city's list shows. */
export const TOP_N = 10;

export interface CityRanking {
  city: string;
  places: RankedPlaceView[];
  total: number;
}

/**
 * Groups a ranked list (already ordered by city, then rank) into one top-10 per
 * city, the longest list first.
 */
export function groupByCity(places: RankedPlaceView[]): CityRanking[] {
  const byCity = new Map<string, RankedPlaceView[]>();
  for (const p of places) {
    const list = byCity.get(p.cityName) ?? [];
    list.push(p);
    byCity.set(p.cityName, list);
  }
  return [...byCity.entries()]
    .map(([city, list]) => ({ city, places: list.slice(0, TOP_N), total: list.length }))
    .sort((a, b) => b.total - a.total);
}
