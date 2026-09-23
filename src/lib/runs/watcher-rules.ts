// Pure wording/routing rules for RunWatcher — kept separate from the effect
// so they are trivial to test.
//
// The noun comes from the run's result-page URL path, not `domain`: the
// server maps "nearby" to DOMAIN_TYPE_GENERAL, and RunInfo.domain (from
// GetRunStatus) arrives as the stringified proto enum number, so neither is
// a reliable word source. The URL path is what actually distinguishes the
// result pages.
import type { Toast } from "~/lib/toast-store";

const PATH_NOUNS: Record<string, string> = {
  "/itinerary": "itinerary",
  "/activities": "activities",
  "/hotels": "hotels",
  "/restaurants": "restaurants",
  "/nearme": "nearby places",
};

const pathOf = (url: string): string => new URL(url || "/", "https://x").pathname;

/** The noun for a run's result page, keyed by its URL's path. */
export function nounFor(url: string): string {
  return PATH_NOUNS[pathOf(url)] ?? "itinerary";
}

/**
 * Whether the viewer is already looking at this run: its result page (same
 * path and sessionId), or the page hosting it inline (`hostPath`: same path,
 * and every query param hostPath names). /chat renders its runs in the
 * conversation while their url points at /itinerary.
 */
export function isOnRunPage(
  pathname: string,
  search: string,
  runUrl: string,
  sessionId: string,
  hostPath?: string,
): boolean {
  const current = new URLSearchParams(search);
  const target = new URL(runUrl || "/", "https://x");
  if (pathname === target.pathname && current.get("sessionId") === sessionId) return true;
  if (!hostPath) return false;
  const host = new URL(hostPath, "https://x");
  if (pathname !== host.pathname) return false;
  for (const [key, value] of host.searchParams) {
    if (current.get(key) !== value) return false;
  }
  return true;
}

/**
 * Where Retry goes: the run's result route with its original query, which
 * every result page re-runs on arrival. The run's url is no use for this —
 * it names a session that failed and carries no query.
 */
export function retryHref(run: { url: string; query: string; city: string }): string {
  const path = pathOf(run.url);
  const params = new URLSearchParams({ message: run.query });
  if (run.city) params.set("cityName", run.city);
  return `${PATH_NOUNS[path] ? path : "/itinerary"}?${params.toString()}`;
}

/**
 * The toast for a run that ended. `go` is called with where the action leads
 * when it is a retry (the watcher unlists the failed run, then navigates):
 * kept as a callback so these rules stay free of the router and the store.
 */
export function runToast(
  run: {
    sessionId: string;
    phase: "complete" | "error";
    city: string;
    url: string;
    /** The original request, when known. A relayed push does not carry it. */
    query?: string;
  },
  go: (href: string) => void,
): Toast {
  const noun = nounFor(run.url);
  const subject = `${run.city} ${noun}`.trim();
  if (run.phase === "complete") {
    // "itinerary is", but "hotels / restaurants / activities / nearby places are".
    const verb = noun === "itinerary" ? "is" : "are";
    return {
      id: run.sessionId,
      title: `Your ${subject} ${verb} ready`,
      action: { label: "Open", href: run.url },
    };
  }
  const query = run.query?.trim();
  if (!query) {
    return {
      id: run.sessionId,
      title: `Your ${subject} didn't finish`,
      action: { label: "New search", run: () => go("/") },
    };
  }
  const href = retryHref({ url: run.url, query, city: run.city });
  return {
    id: run.sessionId,
    title: `Your ${subject} didn't finish`,
    action: { label: "Retry", run: () => go(href) },
  };
}

/**
 * The runs a reload left behind that nobody resumed, and so must be settled
 * by asking the server. A run this tab already saw finish (a completed
 * session is stored for it) is not one: it was announced when it finished.
 */
export function orphanedRunIds(
  pending: string[],
  resumed: ReadonlySet<string>,
  finishedHere: (sessionId: string) => boolean,
): string[] {
  return pending.filter((id) => !resumed.has(id) && !finishedHere(id));
}

/** What the push offer's Allow does once enablePush settles. */
export function pushOutcome(
  result: "granted" | "denied" | "unsupported" | "off" | "error",
): "refresh" | Toast | null {
  if (result === "granted") return "refresh";
  if (result === "error") {
    return { id: "push-error", title: "Couldn't turn on notifications on this device." };
  }
  return null;
}
