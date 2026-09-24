/** How often to re-ask while a just-bought pack still reads locked. */
export const PURCHASE_POLL_MS = 3000;
/** Stop after about two minutes; the page then says to refresh. */
export const PURCHASE_POLL_MAX = 40;

/**
 * The refetch interval for a pack page, or false to stop.
 *
 * Stripe sends the buyer back before its webhook has necessarily granted the
 * pack, so a `?purchased=1` return polls until the pack reads owned (or has no
 * locked days left), then stops. Without a purchase it never polls.
 */
export function purchasePollInterval(
  justPurchased: boolean,
  data: { pack: { owned: boolean }; lockedDayCount: number } | null | undefined,
  fetches: number,
): number | false {
  if (!justPurchased || !data) return false;
  if (data.pack.owned || data.lockedDayCount === 0) return false;
  return fetches < PURCHASE_POLL_MAX ? PURCHASE_POLL_MS : false;
}
