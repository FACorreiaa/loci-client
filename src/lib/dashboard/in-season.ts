/**
 * Merges the curated seasonal picks with what people asked about this week,
 * for the moving strip on the desk. Structural input types so tests need no
 * proto or transport.
 */
import type { SeasonalPick } from "./seasons";
import { promptFor } from "./seasons";

export interface InSeasonTrending {
  city_name: string;
  search_count: number;
  emoji: string;
}

export interface InSeasonItem {
  /** "season:porto" or "trending:funchal". */
  id: string;
  city: string;
  /** Empty for trending-only rows: the server does not say where the city is. */
  countryCode: string;
  emoji: string;
  hook: string;
  /** Sessions this week for the city; 0 when nobody asked. */
  planned: number;
  prompt: string;
}

const MAX_ITEMS = 12;

const key = (city: string): string => city.trim().toLocaleLowerCase();

export const buildInSeasonItems = (
  picks: SeasonalPick[],
  trending: InSeasonTrending[] | undefined,
  max = MAX_ITEMS,
): InSeasonItem[] => {
  const planned = new Map<string, InSeasonTrending>();
  for (const t of trending ?? []) {
    const k = key(t.city_name);
    if (k && !planned.has(k)) planned.set(k, t);
  }

  const seasonal: InSeasonItem[] = picks.map((p) => ({
    id: `season:${key(p.city)}`,
    city: p.city,
    countryCode: p.countryCode,
    emoji: p.emoji,
    hook: p.hook,
    planned: planned.get(key(p.city))?.search_count ?? 0,
    prompt: promptFor(p),
  }));
  const withPlans = seasonal.filter((i) => i.planned > 0);
  const without = seasonal.filter((i) => i.planned === 0);

  const inSeason = new Set(picks.map((p) => key(p.city)));
  const extra: InSeasonItem[] = [...planned.values()]
    .filter((t) => !inSeason.has(key(t.city_name)))
    .map((t) => ({
      id: `trending:${key(t.city_name)}`,
      city: t.city_name.trim(),
      countryCode: "",
      emoji: t.emoji,
      hook: "planned this week",
      planned: t.search_count,
      prompt: `Plan 3 days in ${t.city_name.trim()}`,
    }));

  const seen = new Set<string>();
  return [...withPlans, ...without, ...extra]
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .slice(0, max);
};

/** One loop of the strip: slow enough to read, longer with more items. */
export const marqueeDurationSeconds = (count: number): number => Math.max(30, count * 6);

/** Fewer items than this fit in a row; moving them would look broken. */
export const needsMarquee = (count: number): boolean => count >= 5;
