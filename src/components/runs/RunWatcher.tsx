// Watches every run in the registry. When one ends while you are on some
// other page, it says so, with a way back. It also settles runs a reload
// interrupted, by resuming them or asking the server how they ended.
import { createEffect, on, onCleanup, onMount } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import {
  clearActiveSession,
  liveRuns,
  readActiveSessions,
  removeRun,
  type LiveStream,
} from "~/lib/streaming/live-stream-store";
import { resumeAllLive } from "~/lib/streaming/resume-live";
import { readCompletedSession } from "~/lib/streaming/restore-session";
import { getRunStatuses } from "~/lib/api/llm";
import { dismissToast, showToast } from "~/lib/toast-store";
import { isOnRunPage, orphanedRunIds, pushOutcome, runToast } from "~/lib/runs/watcher-rules";
import { useAuth } from "~/contexts/AuthContext";
import { getNotificationPermission } from "~/lib/notification-prefs";
import { enablePush, getVapidKey, refreshPushRegistration } from "~/lib/push/push-client";
import { readDismissedAt, rememberDismissed, shouldOfferPush } from "~/lib/push/prompt-rules";

// Offered at most once per page load, regardless of how many runs finish or
// how many times RunWatcher's effects re-run — a module-level flag so it
// survives across the checks below rather than being scoped to one of them.
let pushOffered = false;

/** A message the service worker relays from a push event it handled. */
interface LociPushPayload {
  sessionId: string;
  status: string;
  url: string;
  cityName: string;
}

export default function RunWatcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const announced = new Set<string>();

  /**
   * Say once that a run ended, unless you are looking at it. Runs that only
   * the server or the service worker told us about come through here
   * directly: they are NOT added to liveRuns, because a finished entry with
   * no data there is what result pages bind to, and Open then showed a blank
   * page. Left out, the page falls through to its stored copy or the server.
   */
  const toast = (run: {
    sessionId: string;
    phase: "complete" | "error";
    city: string;
    url: string;
    query?: string;
    hostPath?: string;
  }) => {
    const { sessionId } = run;
    if (announced.has(sessionId)) return;
    announced.add(sessionId);
    clearActiveSession(sessionId);
    if (isOnRunPage(location.pathname, location.search, run.url, sessionId, run.hostPath)) return;
    showToast(
      runToast(run, (href) => {
        // A retry is a new run; the failed one has nothing left to show.
        removeRun(sessionId);
        navigate(href);
      }),
    );
  };

  const announce = (sessionId: string) => {
    const run = liveRuns[sessionId];
    if (!run) return;
    if (run.phase !== "complete" && run.phase !== "error") return;
    toast({
      sessionId,
      phase: run.phase,
      city: run.city,
      url: run.url,
      query: run.query,
      hostPath: run.hostPath,
    });
  };

  createEffect(
    on(
      () =>
        Object.values(liveRuns)
          .map((r) => `${r.sessionId}:${r.phase}`)
          .join(","),
      () => Object.keys(liveRuns).forEach(announce),
    ),
  );

  // Offer to enable push the moment someone navigates away from a search
  // that is still running — the point at which "ping me when it's ready"
  // is most obviously useful. Compares the route just left, not the one just
  // entered, so this fires on the transition out of a run's own page.
  const offerPush = async (run: LiveStream) => {
    if (pushOffered) return;
    // Reserved synchronously, before the await below: two navigations racing
    // through this same tick must not both pass the check above and both go
    // on to show (or register) the offer.
    pushOffered = true;
    const offer = shouldOfferPush({
      permission: getNotificationPermission(),
      hasKey: Boolean(await getVapidKey()),
      dismissedAt: readDismissedAt(),
      now: Date.now(),
    });
    if (!offer) return;
    showToast({
      id: "push-offer",
      title: `Searching ${run.city || "for you"}… Want a ping when it's ready?`,
      // enablePush() is called synchronously inside the click handler so the
      // browser still counts Notification.requestPermission() as
      // user-initiated; only its result is handled later.
      action: {
        label: "Allow",
        run: () => {
          void enablePush().then((result) => {
            const outcome = pushOutcome(result);
            if (outcome === "refresh") void refreshPushRegistration();
            else if (outcome) showToast(outcome);
          });
        },
      },
      secondary: {
        label: "Not now",
        run: () => {
          rememberDismissed();
          dismissToast("push-offer");
        },
      },
    });
  };

  createEffect(
    on(
      () => ({ pathname: location.pathname, search: location.search }),
      (_current, previous) => {
        if (!previous || pushOffered) return;
        const leavingRun = Object.values(liveRuns).find(
          (run) =>
            (run.phase === "connecting" || run.phase === "streaming") &&
            isOnRunPage(previous.pathname, previous.search, run.url, run.sessionId, run.hostPath),
        );
        if (leavingRun) void offerPush(leavingRun);
      },
    ),
  );

  // Re-subscribe + re-register this device whenever the session goes from
  // signed-out to signed-in: on sign-in, and also on first load when the
  // stored session is already valid (`wasSignedIn` is undefined then). Not on
  // every render. A device that already granted permission should keep
  // receiving pushes without being asked again.
  createEffect(
    on(isAuthenticated, (signedIn, wasSignedIn) => {
      if (signedIn && !wasSignedIn) void refreshPushRegistration();
    }),
  );

  // onMount only fires after the component is actually mounted in the DOM,
  // which happens client-side only — SolidStart's SSR render never calls it,
  // so this is safe even though readActiveSessions/getRunStatuses touch
  // sessionStorage and the network.
  //
  // Kept synchronous (the resume-orphans work below is a fire-and-forget
  // async task, not an awaited body) so the onCleanup() call further down
  // still runs inside onMount's own synchronous tick. onCleanup needs Solid's
  // current reactive owner, which is only available synchronously; calling it
  // after an `await` would either throw or silently attach to nothing.
  onMount(() => {
    void (async () => {
      // Read before anything settles: the envelope is the only place a
      // reloaded run's original query survives, and Retry needs it.
      const envelopes = new Map(readActiveSessions().map((e) => [e.sessionId, e]));
      const finishedHere = (id: string) => readCompletedSession(id) !== null;
      // A run this tab saw finish was announced then; its envelope is stale.
      for (const id of envelopes.keys()) if (finishedHere(id)) clearActiveSession(id);
      const resumed = new Set(resumeAllLive());
      const orphaned = orphanedRunIds([...envelopes.keys()], resumed, finishedHere);
      if (orphaned.length === 0) return;
      try {
        for (const info of await getRunStatuses(orphaned)) {
          if (info.status === "running") continue;
          toast({
            sessionId: info.sessionId,
            phase: info.status === "done" ? "complete" : "error",
            url: info.url,
            city: info.cityName,
            query: envelopes.get(info.sessionId)?.query,
          });
        }
      } catch {
        /* signed out or offline: the pages still restore on their own */
      }
    })();

    // The service worker (Task 16) posts one of these when a push arrives
    // while this tab is open. It is toasted directly, deduped by `announced`
    // against this tab's own completion of the same run. A push carries no
    // query, so Retry only knows one if this tab is running that search.
    if ("serviceWorker" in navigator) {
      const handlePushMessage = (e: MessageEvent) => {
        const payload = (e.data as { lociPush?: LociPushPayload } | undefined)?.lociPush;
        if (!payload?.sessionId) return;
        const known = liveRuns[payload.sessionId];
        toast({
          sessionId: payload.sessionId,
          phase: payload.status === "done" ? "complete" : "error",
          url: payload.url,
          city: payload.cityName,
          query: known?.query,
          hostPath: known?.hostPath,
        });
      };
      navigator.serviceWorker.addEventListener("message", handlePushMessage);
      onCleanup(() => navigator.serviceWorker.removeEventListener("message", handlePushMessage));
    }
  });

  return null;
}
