/**
 * Stable ids for globe legs.
 *
 * A GlobeArc carries no id of its own, and the page used `tripId-index`: a
 * refetch that added or reordered one leg shifted every id after it, so the
 * highlighted leg jumped to a different one. The key is now the leg itself —
 * trip, endpoints and when it happened — which is what iOS keys on too.
 *
 * Two legs can still share all four (the same drive twice on one day with no
 * time recorded), so repeats get an occurrence suffix. That suffix depends only
 * on the order of the identical legs among themselves, not on anything else in
 * the list.
 */
export interface LegIdentity {
  tripId?: string;
  fromName: string;
  toName: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  occurredAt?: Date;
}

const coord = (n: number) => (Number.isFinite(n) ? n.toFixed(4) : "?");

export function legKey(leg: LegIdentity): string {
  const from = leg.fromName || `${coord(leg.fromLat)},${coord(leg.fromLon)}`;
  const to = leg.toName || `${coord(leg.toLat)},${coord(leg.toLon)}`;
  const when = leg.occurredAt ? leg.occurredAt.toISOString() : "";
  return `${leg.tripId ?? ""}|${from}|${to}|${when}`;
}

/** One id per leg, in input order; unique within the list. */
export function legIds(legs: readonly LegIdentity[]): string[] {
  const seen = new Map<string, number>();
  return legs.map((leg) => {
    const key = legKey(leg);
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? key : `${key}#${n}`;
  });
}
