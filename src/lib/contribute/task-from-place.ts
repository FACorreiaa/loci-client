import type { VerificationTask } from "~/lib/api/place-intelligence";
import { CONTRIBUTABLE_FIELDS } from "~/lib/place-facts/vocabulary";

/**
 * A catalogued place that is not already a knowledge-gap task.
 *
 * Contribute's queue only asks about fields the server already thinks are
 * stale. A scout who knows a different place still has something to file —
 * every field we know how to ask.
 */
export function taskFromPlace(place: { id: string; name: string }): VerificationTask {
  return {
    poiId: place.id,
    poiName: place.name,
    requestedFields: [...CONTRIBUTABLE_FIELDS],
  };
}

/** Prefer the server's gap list when the searched place is already on it. */
export function resolveTask(
  place: { id: string; name: string },
  tasks: VerificationTask[],
): VerificationTask {
  return tasks.find((task) => task.poiId === place.id) ?? taskFromPlace(place);
}
