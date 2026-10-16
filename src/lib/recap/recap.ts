// Pure helpers for trip recaps: when a trip has a recap to show, the link
// preview for a shared recap, and the small bits of wording the cards share.
// No DOM, no network except the injected fetch, so all of it runs on the
// server and in tests.

export interface RecapTripLike {
  startDate?: string;
  endDate?: string;
  days: { date?: string; completedAt?: string }[];
}

const localISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Whether a trip is over, so its recap can be asked for. Mirrors the server:
 * the end date has passed (or the last dated day, when the trip has no end
 * date), or every day has been walked.
 */
export const tripHasEnded = (trip: RecapTripLike, now: Date = new Date()): boolean => {
  const days = trip.days ?? [];
  if (days.length > 0 && days.every((d) => !!d.completedAt)) return true;
  const today = localISODate(now);
  if (trip.endDate) return trip.endDate.slice(0, 10) < today;
  const dated = days
    .map((d) => d.date)
    .filter((d): d is string => !!d)
    .map((d) => localISODate(new Date(d)))
    .sort();
  const last = dated[dated.length - 1];
  return !!last && last < today;
};

interface CaseCard {
  card: { case?: string };
}

/** Cards this build knows how to draw. A newer server may send more; they are skipped. */
const KNOWN_CARDS = new Set([
  "intro",
  "places",
  "route",
  "days",
  "taste",
  "highlights",
  "progress",
  "field",
  "friends",
  "outro",
]);
const LIGHT_CARDS = new Set(["places", "days", "taste", "highlights", "field", "friends"]);

export const playableCards = <T extends CaseCard>(cards: T[]): T[] =>
  cards.filter((c) => !!c.card.case && KNOWN_CARDS.has(c.card.case));

/** Whether a card is drawn on a light ground (the player's bars go dark on it). */
export const isLightCard = (card: CaseCard | undefined): boolean =>
  !!card?.card.case && LIGHT_CARDS.has(card.card.case);

/** "41 km", "1,204 km", "0.8 km". */
export const formatKm = (km: number): string => {
  if (!Number.isFinite(km) || km <= 0) return "0 km";
  if (km < 10) return `${km.toFixed(1).replace(/\.0$/, "")} km`;
  return `${Math.round(km).toLocaleString("en-GB")} km`;
};

/** Caption under the distance, saying honestly what it measures. */
export const routeBasisCaption = (basis: number): string => {
  switch (basis) {
    case 1:
      return "along your legs";
    case 2:
      return "as the crow flies between cities";
    case 3:
      return "between the places you visited";
    default:
      return "";
  }
};

/** "From 7 saves", "From 5 visits"; empty when there is no evidence to cite. */
export const evidenceLine = (count: number, kind: number): string => {
  if (!count) return "";
  const noun = kind === 1 ? "save" : kind === 2 ? "visit" : kind === 3 ? "review" : "signal";
  return `From ${count} ${noun}${count === 1 ? "" : "s"}`;
};

export const trendLabel = (trend: number): string =>
  trend === 1 ? "New" : trend === 2 ? "Growing" : trend === 3 ? "Strong" : "";

/** Up to two initials, for a friend shown without an avatar. */
export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => [...p][0] ?? "")
    .join("");
  return letters.toUpperCase() || "?";
};

/** Where a recap's shared images live on the API. */
export const recapImageUrl = (apiBase: string, code: string, card: string): string =>
  `${apiBase.replace(/\/$/, "")}/recap-img/${encodeURIComponent(code)}/${encodeURIComponent(card)}.png`;

export const recapSharePath = (code: string) => `/r/${encodeURIComponent(code)}`;

export interface SharedRecapMeta {
  title: string;
  description: string;
  image: string;
}

interface WireRecap {
  title?: string;
  subtitle?: string;
  periodLabel?: string;
  owner?: { displayName?: string };
  cards?: { outro?: { summaryLine?: string } }[];
}

/** Builds the preview from a GetSharedRecap JSON response. Pure. */
export const sharedRecapMeta = (
  apiBase: string,
  code: string,
  recap: WireRecap | undefined,
): SharedRecapMeta | undefined => {
  if (!recap?.title) return undefined;
  const who = recap.owner?.displayName;
  const summary = recap.cards?.find((c) => c.outro?.summaryLine)?.outro?.summaryLine;
  return {
    title: who ? `${who}'s ${recap.title} recap` : `${recap.title} recap`,
    description: [summary || recap.subtitle, "Plan your own trip with Loci."]
      .filter(Boolean)
      .join(". "),
    image: recapImageUrl(apiBase, code, "og"),
  };
};

/** Fetches the preview; undefined on any failure (the page still renders). */
export const fetchSharedRecapMeta = async (
  apiBase: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SharedRecapMeta | undefined> => {
  try {
    const res = await fetchImpl(`${apiBase}/loci.recap.RecapService/GetSharedRecap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Connect-Protocol-Version": "1" },
      body: JSON.stringify({ shareCode: code }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { recap?: WireRecap };
    return sharedRecapMeta(apiBase, code, body.recap);
  } catch {
    return undefined;
  }
};
