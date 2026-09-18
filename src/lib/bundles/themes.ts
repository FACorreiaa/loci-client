/**
 * The taste vocabulary a City Pack can be cut for.
 *
 * This mirrors `Themes` in the server's `internal/domain/bundle/forge/seeds.go`.
 * The catalog filters on these exact ids, so adding one means changing both
 * sides — the test alongside this file is what stops them drifting apart
 * silently.
 */
export const PACK_THEMES = [
  "food",
  "art",
  "outdoors",
  "architecture",
  "nightlife",
  "family",
  "local_life",
] as const;

export type PackTheme = (typeof PACK_THEMES)[number];

export interface PackThemeMeta {
  id: PackTheme;
  label: string;
  emoji: string;
}

export const PACK_THEME_META: Record<PackTheme, PackThemeMeta> = {
  food: { id: "food", label: "Food & wine", emoji: "🍷" },
  art: { id: "art", label: "Art & music", emoji: "🎨" },
  outdoors: { id: "outdoors", label: "Outdoors", emoji: "🥾" },
  architecture: { id: "architecture", label: "Architecture", emoji: "🏛️" },
  nightlife: { id: "nightlife", label: "Nightlife", emoji: "🌃" },
  family: { id: "family", label: "Family", emoji: "🧸" },
  local_life: { id: "local_life", label: "Local life", emoji: "🚋" },
};

export const isPackTheme = (v: string): v is PackTheme =>
  (PACK_THEMES as readonly string[]).includes(v);

export const themeLabel = (id: string): string =>
  isPackTheme(id) ? PACK_THEME_META[id].label : id;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Render a pack's months the way a person would say them.
 *
 * Consecutive months collapse into a range, and a set that wraps the year end
 * (Nov, Dec, Jan, Feb — which is most of the winter packs) reads as one range
 * rather than two, because "Nov–Feb" is what somebody means by that.
 */
export function monthsLabel(months: number[]): string {
  const sorted = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (sorted.length === 0) return "Any time";
  if (sorted.length === 12) return "All year";

  // Find the longest run, treating December as adjacent to January.
  const runs: number[][] = [];
  let run: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) run.push(sorted[i]);
    else {
      runs.push(run);
      run = [sorted[i]];
    }
  }
  runs.push(run);

  if (runs.length > 1 && sorted.includes(1) && sorted.includes(12)) {
    const first = runs[0];
    const last = runs[runs.length - 1];
    runs.pop();
    runs.shift();
    runs.unshift([...last, ...first]);
  }

  return runs
    .map((r) =>
      r.length === 1
        ? MONTH_NAMES[r[0] - 1]
        : `${MONTH_NAMES[r[0] - 1]}–${MONTH_NAMES[r[r.length - 1] - 1]}`,
    )
    .join(", ");
}

/** Price for display. The charge itself always comes from Stripe. */
export function priceLabel(cents: number, currency: string): string {
  const symbol = currency?.toLowerCase() === "eur" ? "€" : "$";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}
