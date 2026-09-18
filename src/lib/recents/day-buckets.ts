import type { ActivityEntry } from "./types";

export interface ActivityDayGroup {
  key: "today" | "yesterday" | "week" | "earlier";
  label: string;
  entries: ActivityEntry[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Midnight of the day `date` falls on, in the viewer's own timezone.
 *
 * The server sends UTC, but "today" is the user's today. Comparing raw
 * timestamps puts an evening in Lisbon into yesterday for anyone west of it and
 * into tomorrow for anyone east.
 */
function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Group feed entries under Today / Yesterday / This week / Earlier.
 *
 * `now` is passed in rather than read from the clock so the result is a pure
 * function of its inputs: the caller captures it once, the memo stays stable,
 * and the boundaries are testable. The cost is that the headings do not move on
 * their own at midnight, which nobody watching a history page will notice.
 *
 * Entries are assumed to arrive newest-first, as the feed returns them; this
 * preserves that order within each group and does not re-sort.
 */
export function bucketByDay(entries: ActivityEntry[], now: Date): ActivityDayGroup[] {
  const groups: ActivityDayGroup[] = [
    { key: "today", label: "Today", entries: [] },
    { key: "yesterday", label: "Yesterday", entries: [] },
    { key: "week", label: "This week", entries: [] },
    { key: "earlier", label: "Earlier", entries: [] },
  ];

  const today = startOfLocalDay(now);

  for (const entry of entries) {
    const at = new Date(entry.occurredAt);
    if (Number.isNaN(at.getTime())) {
      groups[3].entries.push(entry);
      continue;
    }
    // Days between, not hours: an entry from 23:50 last night is yesterday at
    // 00:30 this morning, even though it is forty minutes old.
    const daysAgo = Math.round((today - startOfLocalDay(at)) / DAY_MS);
    if (daysAgo <= 0) groups[0].entries.push(entry);
    else if (daysAgo === 1) groups[1].entries.push(entry);
    else if (daysAgo < 7) groups[2].entries.push(entry);
    else groups[3].entries.push(entry);
  }

  return groups.filter((g) => g.entries.length > 0);
}

/** "2h ago", "Yesterday", "12 Mar" — the short form a feed row shows. */
export function relativeTime(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";

  const minutes = Math.floor((now.getTime() - at.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(at)) / DAY_MS);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;

  return at.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
