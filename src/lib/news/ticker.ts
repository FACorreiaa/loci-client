/**
 * Pure helpers for the breaking-news band. Kept away from the query and the
 * component so they can be tested without a DOM or a transport.
 */

export interface NewsTickerItem {
  id: string;
  title: string;
  url: string;
  source: string;
  /** ISO timestamp. */
  publishedAt: string;
  /** ISO 3166-1 alpha-2 the headline was selected for, or "". */
  countryCode: string;
}

export interface NewsTickerData {
  enabled: boolean;
  stale: boolean;
  countryCodes: string[];
  items: NewsTickerItem[];
}

/** Coarse relative time: a ticker says "2h", not a timestamp. */
export const timeAgo = (iso: string, now: Date): string => {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "";
  const ms = now.getTime() - at;
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

/** Regional-indicator flag for an alpha-2 code; empty when unknown. */
export const flagFor = (code: string): string => {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
};

/** Items grouped in the order the server selected the countries. */
export const groupByCountry = (data: NewsTickerData): { code: string; items: NewsTickerItem[] }[] => {
  const groups = new Map<string, NewsTickerItem[]>();
  for (const code of data.countryCodes) groups.set(code, []);
  for (const it of data.items) {
    const key = groups.has(it.countryCode) ? it.countryCode : "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  return [...groups.entries()].filter(([, items]) => items.length > 0).map(([code, items]) => ({ code, items }));
};

const SNAPSHOT_KEY = "loci-news-ticker-snapshot";

export interface NewsSnapshot {
  savedAt: string;
  data: NewsTickerData;
}

/** Last ticker the browser saw, so the desk paints something offline. */
export const loadSnapshot = (storage: Pick<Storage, "getItem"> | undefined): NewsSnapshot | undefined => {
  try {
    const raw = storage?.getItem(SNAPSHOT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as NewsSnapshot;
    if (!parsed?.data || !Array.isArray(parsed.data.items)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
};

export const saveSnapshot = (storage: Pick<Storage, "setItem"> | undefined, data: NewsTickerData, now: Date): void => {
  try {
    storage?.setItem(SNAPSHOT_KEY, JSON.stringify({ savedAt: now.toISOString(), data } satisfies NewsSnapshot));
  } catch {
    // Quota or private mode: the band simply has no offline fallback.
  }
};
