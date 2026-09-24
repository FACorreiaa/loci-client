/**
 * When a data update may move the camera.
 *
 * The camera follows the pins while nobody is steering it and stops the
 * moment somebody is. A multi-city stream keeps adding one city's pins for
 * minutes, and refitting on every batch cancelled each pan the user started —
 * Mapbox drops an in-progress drag the instant an animation begins — so a
 * trip whose first city was still planning could not be explored at all.
 *
 * A different set of places still takes the view: another city chosen, "All
 * days" narrowed to one city or one city widened to the trip, a new search.
 * What the user was looking at is gone, so there is nothing to keep.
 */
export interface CameraFollow {
  /** The pins the camera last fitted (or last saw, when it did not fit). */
  ids: ReadonlySet<string>;
  /** The user moved the camera since those pins were fitted. */
  userMoved: boolean;
}

export function shouldRefit(prev: CameraFollow | null, next: readonly string[]): boolean {
  if (next.length === 0) return false;
  if (!prev || prev.ids.size === 0) return true;
  let overlap = 0;
  for (const id of next) if (prev.ids.has(id)) overlap++;
  // Most of what was shown is gone, or most of what is shown is new: a
  // different view, not the same one filling in.
  const different = overlap < prev.ids.size / 2 || next.length - overlap > next.length / 2;
  return different || !prev.userMoved;
}
