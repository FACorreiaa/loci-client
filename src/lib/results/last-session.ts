// The list a detail page came from, so its Back link returns there.
//
// /hotels/{id} is reached from a list page and from the saved hub, and only
// the list page has a session to go back to. The list page notes its session
// here as it renders; the detail page reads it. Session storage: the tab's
// own history, and nothing to sync.
import type { ResultsDomain } from "./domain";

export interface LastResultsSession {
  sessionId: string;
  cityName?: string;
}

const key = (domain: ResultsDomain) => `loci:last-results:${domain}`;

export function rememberResultsSession(domain: ResultsDomain, entry: LastResultsSession): void {
  if (!entry.sessionId) return;
  try {
    sessionStorage.setItem(key(domain), JSON.stringify(entry));
  } catch {
    /* private mode / quota: the Back link falls back to the bare list route */
  }
}

export function lastResultsSession(domain: ResultsDomain): LastResultsSession | null {
  try {
    const raw = sessionStorage.getItem(key(domain));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastResultsSession;
    return parsed && typeof parsed.sessionId === "string" && parsed.sessionId ? parsed : null;
  } catch {
    return null;
  }
}

/** The list route with the last session in its query, or the bare route. */
export function backToResultsHref(domain: ResultsDomain, fallbackCity?: string): string {
  const base = `/${domain}`;
  const last = lastResultsSession(domain);
  const params = new URLSearchParams();
  if (last?.sessionId) params.set("sessionId", last.sessionId);
  const city = last?.cityName || fallbackCity;
  if (city) params.set("cityName", city);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
