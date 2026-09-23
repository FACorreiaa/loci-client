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

/** The noun for a run's result page, keyed by its URL's path. */
export function nounFor(url: string): string {
  const pathname = new URL(url, "https://x").pathname;
  return PATH_NOUNS[pathname] ?? "itinerary";
}

/** Whether the viewer is already looking at this run's result page. */
export function isOnRunPage(
  pathname: string,
  search: string,
  runUrl: string,
  sessionId: string,
): boolean {
  const target = new URL(runUrl, "https://x");
  return pathname === target.pathname && new URLSearchParams(search).get("sessionId") === sessionId;
}

export function runToast(run: {
  sessionId: string;
  phase: "complete" | "error";
  city: string;
  url: string;
}): Toast {
  const subject = `${run.city} ${nounFor(run.url)}`.trim();
  if (run.phase === "complete") {
    return {
      id: run.sessionId,
      title: `Your ${subject} is ready`,
      action: { label: "Open", href: run.url },
    };
  }
  // Retry navigates to the run's page: every result page already re-runs the
  // query when its session restores nothing, and a failed run left nothing
  // to restore, so no second retry path is needed.
  return {
    id: run.sessionId,
    title: `Your ${subject} didn't finish`,
    action: { label: "Retry", href: run.url },
  };
}
