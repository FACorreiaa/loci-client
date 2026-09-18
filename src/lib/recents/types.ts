/**
 * One entry of the recents activity feed.
 *
 * The feed is deliberately flat: one row per thing the person did, whichever
 * table it came from. `kind` says which, and `detail` narrows it — the domain a
 * prompt was routed as, or the content type of a favourite.
 */
export type ActivityKind = "prompt" | "saved_itinerary" | "favourite";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  /** Domain for a prompt, content type for a favourite, "itinerary" for a save. */
  detail: string;
  /** What the person typed, or the title of the thing they kept. */
  label: string;
  cityName: string;
  /**
   * What to navigate with: the chat session id for a prompt or a saved
   * itinerary, the item id for a favourite.
   */
  refId: string;
  /** ISO 8601, UTC. */
  occurredAt: string;
}
