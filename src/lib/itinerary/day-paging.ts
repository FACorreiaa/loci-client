/**
 * How much of a trip to show at once.
 *
 * A four-day answer is twenty-four cards, and dropping all of them on the page
 * at once buries the first day under the last. Paging happens by DAY and never
 * by stop count: cutting a day in half reads as a bug in an itinerary, where
 * the grouping is the content.
 *
 * This is deliberately a pure function over already-grouped days rather than a
 * fetch. The whole itinerary arrives in one streamed payload, so there is
 * nothing to go and get — the server's GetSessionPOIs exists for Telegram,
 * which has no client-side store to slice.
 */

/** Days shown before the reader asks for the rest. */
export const INITIAL_DAYS = 2;

export interface DayWindow<T> {
  visible: T[];
  /** Days not shown yet. Zero means the button should not exist. */
  remaining: number;
}

export function windowDays<T>(days: T[], visibleCount: number): DayWindow<T> {
  if (visibleCount >= days.length) return { visible: days, remaining: 0 };
  const count = Math.max(1, visibleCount);
  return { visible: days.slice(0, count), remaining: days.length - count };
}
