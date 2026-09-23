// Pure rules for the in-context push permission offer, kept separate from the
// watcher effect so they are trivial to test. Storage access lives in this
// file too, wrapped in try/catch: private mode and disabled storage must not
// throw, they just mean the person may be asked again next time.
export const DISMISS_KEY = "loci.pushPrompt.dismissedAt";
const THIRTY_DAYS = 30 * 86_400_000;

export function shouldOfferPush(o: {
  permission: "default" | "granted" | "denied" | "unsupported";
  hasKey: boolean;
  dismissedAt: number | null;
  now: number;
}): boolean {
  if (o.permission !== "default" || !o.hasKey) return false;
  return o.dismissedAt === null || o.now - o.dismissedAt > THIRTY_DAYS;
}

export function readDismissedAt(): number | null {
  try {
    const v = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function rememberDismissed(now = Date.now()): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(now));
  } catch {
    /* private mode: they may be asked again next time */
  }
}
