// How well a place fits the traveller, as the server scored it against their
// taste. Absent when the server could not score it (signed out, too little
// feedback yet, personalization off), and then nothing is shown: a made-up
// percentage would be worse than none.

export interface TasteMatchView {
  /** 0–1, where this place falls among places in general, for this traveller. */
  score: number;
  /** Up to three plain-language reasons, most personal first. */
  reasons: string[];
}

/** Cards only show a match worth pointing at; the detail page shows any. */
export const CARD_MATCH_THRESHOLD = 0.6;

export function fromProtoTasteMatch(
  m: { score: number; reasons: string[] } | undefined,
): TasteMatchView | undefined {
  if (!m) return undefined;
  return { score: m.score, reasons: (m.reasons ?? []).filter((r) => r.trim()) };
}

export function matchPercent(m: TasteMatchView | undefined): number | undefined {
  return m ? Math.round(m.score * 100) : undefined;
}

export function matchLabel(m: TasteMatchView): string {
  return `${matchPercent(m)}% match`;
}

export function showOnCard(m: TasteMatchView | undefined): boolean {
  return !!m && m.score >= CARD_MATCH_THRESHOLD;
}
