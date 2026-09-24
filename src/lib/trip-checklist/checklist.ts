/**
 * Trip checklists (packing + expenses): the pure half.
 *
 * The lists used to live only in this browser's localStorage, per trip. They
 * are now server-synced through TripService (GetTripChecklist and friends) so
 * iOS and web share one list. What is here: money in minor units, ordering,
 * totals, and the one-time import of whatever an older build left in
 * localStorage.
 */

export type ChecklistKind = "packing" | "expense";

export interface ChecklistEntry {
  /** Client-generated UUID: the upsert key, so a retried write is a repeat. */
  id: string;
  kind: ChecklistKind;
  text: string;
  done: boolean;
  /** Minor units (cents). Zero for packing items. */
  amountMinor: number;
  /** ISO 4217, upper case. Empty for packing items. */
  currency: string;
  position: number;
}

/** Server limits (proto validation): text ≤ 300, amount ≥ 0, currency ^[A-Z]{3}$. */
export const MAX_TEXT = 300;

export const newChecklistId = (): string => crypto.randomUUID();

/** Fraction digits a currency uses: 2 for EUR, 0 for JPY. */
export function minorDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** A typed amount in major units to minor units; null when it is not an amount. */
export function toMinor(amount: number, currency: string): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 10 ** minorDigits(currency));
}

export function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** minorDigits(currency);
}

export const normaliseCurrency = (c: string | undefined, fallback: string): string => {
  const up = (c ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(up) ? up : fallback;
};

export const clipText = (t: string): string => t.trim().slice(0, MAX_TEXT);

export function sortEntries(items: readonly ChecklistEntry[]): ChecklistEntry[] {
  return [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/** The next position at the end of one kind's list. */
export function nextPosition(items: readonly ChecklistEntry[], kind: ChecklistKind): number {
  return items.filter((i) => i.kind === kind).reduce((max, i) => Math.max(max, i.position + 1), 0);
}

/** Expense totals per currency, in minor units, in first-seen order. */
export function totalsByCurrency(items: readonly ChecklistEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const i of items) {
    if (i.kind !== "expense") continue;
    totals.set(i.currency, (totals.get(i.currency) ?? 0) + i.amountMinor);
  }
  return totals;
}

// ---------------------------------------------------------------------------
// One-time import of the localStorage lists older builds kept
// ---------------------------------------------------------------------------

export function legacyChecklistKeys(tripId: string) {
  return {
    packing: `trip-packing-${tripId}`,
    expenses: `trip-expenses-${tripId}`,
    dismissed: `trip-packing-dismissed-${tripId}`,
  };
}

interface StorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

const parseArray = (raw: string | null): unknown[] => {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export interface LegacyChecklist {
  packing: { text: string; done: boolean }[];
  expenses: { label: string; amount: number }[];
  dismissed: string[];
}

/** What an older build left for this trip, or null when there is nothing. */
export function readLegacyChecklist(storage: StorageLike, tripId: string): LegacyChecklist | null {
  const keys = legacyChecklistKeys(tripId);
  const packing = parseArray(storage.getItem(keys.packing))
    .map((p) => p as { text?: unknown; done?: unknown })
    .filter((p) => typeof p?.text === "string" && p.text.trim() !== "")
    .map((p) => ({ text: p.text as string, done: p.done === true }));
  const expenses = parseArray(storage.getItem(keys.expenses))
    .map((e) => e as { label?: unknown; amount?: unknown })
    .filter((e) => typeof e?.label === "string" && e.label.trim() !== "")
    .map((e) => ({ label: e.label as string, amount: Number(e.amount) }));
  const dismissed = parseArray(storage.getItem(keys.dismissed)).filter(
    (d): d is string => typeof d === "string" && d.trim() !== "",
  );
  if (packing.length === 0 && expenses.length === 0 && dismissed.length === 0) return null;
  return { packing, expenses, dismissed };
}

export function clearLegacyChecklist(storage: StorageLike, tripId: string): void {
  const keys = legacyChecklistKeys(tripId);
  storage.removeItem(keys.packing);
  storage.removeItem(keys.expenses);
  storage.removeItem(keys.dismissed);
}

const sameItem = (kind: ChecklistKind, text: string, amountMinor: number) => (i: ChecklistEntry) =>
  i.kind === kind &&
  i.text.trim().toLowerCase() === text.trim().toLowerCase() &&
  i.amountMinor === amountMinor;

/**
 * The legacy items to upload, as new entries appended after what the server
 * already has.
 *
 * Anything already on the server with the same kind, text and amount is
 * skipped. That makes the import safe to run twice — after a partial failure,
 * or when the same browser list was already imported from another tab — which
 * matters because a failed import keeps the localStorage keys to try again.
 */
export function planLegacyImport(
  legacy: LegacyChecklist,
  server: readonly ChecklistEntry[],
  currency: string,
  serverDismissed: readonly string[] = [],
  makeId: () => string = newChecklistId,
): { items: ChecklistEntry[]; dismissed: string[] } {
  const items: ChecklistEntry[] = [];
  const seen = [...server];
  let packPos = nextPosition(server, "packing");
  let expPos = nextPosition(server, "expense");

  for (const p of legacy.packing) {
    const text = clipText(p.text);
    if (!text || seen.some(sameItem("packing", text, 0))) continue;
    const entry: ChecklistEntry = {
      id: makeId(),
      kind: "packing",
      text,
      done: p.done,
      amountMinor: 0,
      currency: "",
      position: packPos++,
    };
    items.push(entry);
    seen.push(entry);
  }

  for (const e of legacy.expenses) {
    const text = clipText(e.label);
    // The old list took any number, negatives included; the server only takes
    // amounts ≥ 0, so a negative becomes its size rather than failing the import.
    const minor = toMinor(Math.abs(e.amount), currency);
    if (!text || minor === null || seen.some(sameItem("expense", text, minor))) continue;
    const entry: ChecklistEntry = {
      id: makeId(),
      kind: "expense",
      text,
      done: false,
      amountMinor: minor,
      currency,
      position: expPos++,
    };
    items.push(entry);
    seen.push(entry);
  }

  const gone = new Set(serverDismissed.map((d) => d.trim().toLowerCase()));
  const dismissed: string[] = [];
  for (const d of legacy.dismissed.map(clipText)) {
    const key = d.toLowerCase();
    if (!d || gone.has(key)) continue;
    gone.add(key);
    dismissed.push(d);
  }

  return { items, dismissed };
}
