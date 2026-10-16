import type {
  RecommendationEvent,
  RecommendationEventName,
  RecommendationTrace,
} from "~/lib/api/recommendations";

/** The part of a result a learning event needs. */
export interface TracedResult {
  id?: string;
  name: string;
  recommendation_trace?: RecommendationTrace;
}

/**
 * The learning event for an outcome on a result, or undefined when the result
 * carries no trace: the server only accepts events for recommendations it
 * issued, so an untraced event would be rejected.
 */
export function outcomeEvent(
  poi: TracedResult,
  eventType: RecommendationEventName,
): RecommendationEvent | undefined {
  if (!poi.recommendation_trace) return undefined;
  return { eventType, trace: poi.recommendation_trace, poiId: poi.id || undefined };
}

/** Stable key for a result: its id, or its name for places that have none. */
export const resultKey = (poi: TracedResult) => poi.id || `name:${poi.name}`;

/** The results the traveller has not waved away. */
export function withoutDismissed<T extends TracedResult>(
  pois: T[],
  dismissed: ReadonlySet<string>,
): T[] {
  return dismissed.size === 0 ? pois : pois.filter((poi) => !dismissed.has(resultKey(poi)));
}

/**
 * A results page after dismissals: the list and the extras both filtered, and
 * where the extras' numbering starts. The page derives its cards, its map pins
 * and the extras block from this one value so all three agree.
 */
export function visibleResults<T extends TracedResult>(
  list: T[],
  extras: T[],
  dismissed: ReadonlySet<string>,
): { list: T[]; extras: T[]; extrasStart: number } {
  const shown = withoutDismissed(list, dismissed);
  return { list: shown, extras: withoutDismissed(extras, dismissed), extrasStart: shown.length };
}
