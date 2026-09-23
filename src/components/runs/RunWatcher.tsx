// Watches every run in the registry. When one ends while you are on some
// other page, it says so, with a way back. It also settles runs a reload
// interrupted, by resuming them or asking the server how they ended.
import { createEffect, on, onCleanup, onMount } from "solid-js";
import { useLocation } from "@solidjs/router";
import {
  clearActiveSession,
  liveRuns,
  readActiveSessions,
  upsertRun,
  type LiveStream,
} from "~/lib/streaming/live-stream-store";
import { resumeAllLive } from "~/lib/streaming/resume-live";
import { getRunStatuses } from "~/lib/api/llm";
import { dismissToast, showToast } from "~/lib/toast-store";
import { isOnRunPage, runToast } from "~/lib/runs/watcher-rules";
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
  const { isAuthenticated } = useAuth();
  const announced = new Set<string>();

  const announce = (sessionId: string) => {
    const run = liveRuns[sessionId];
    if (!run || announced.has(sessionId)) return;
    if (run.phase !== "complete" && run.phase !== "error") return;
    announced.add(sessionId);
    clearActiveSession(sessionId);
    if (isOnRunPage(location.pathname, location.search, run.url, sessionId)) return;
    showToast(runToast({ sessionId, phase: run.phase, city: run.city, url: run.url }));
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
      // Runs synchronously inside the click handler so the browser still
      // counts Notification.requestPermission() as user-initiated.
      action: { label: "Allow", run: () => void enablePush() },
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
            isOnRunPage(previous.pathname, previous.search, run.url, run.sessionId),
        );
        if (leavingRun) void offerPush(leavingRun);
      },
    ),
  );

  // Re-subscribe + re-register this device once per sign-in (not on every
  // render): a device that already granted permission on one account should
  // keep receiving pushes without being asked again after signing back in.
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
      const pending = readActiveSessions().map((e) => e.sessionId);
      const resumed = new Set(resumeAllLive());
      const orphaned = pending.filter((id) => !resumed.has(id));
      if (orphaned.length === 0) return;
      try {
        for (const info of await getRunStatuses(orphaned)) {
          if (info.status === "running") continue;
          upsertRun(info.sessionId, {
            phase: info.status === "done" ? "complete" : "error",
            url: info.url,
            city: info.cityName,
            // Wording is derived from the result page's URL, not this field
            // (see watcher-rules.ts) — a harmless placeholder is enough to
            // satisfy LiveStream's shape here.
            domain: "general",
          });
        }
      } catch {
        /* signed out or offline: the pages still restore on their own */
      }
    })();

    // The service worker (Task 16) posts one of these when a push arrives
    // while this tab is open. Folding it into `liveRuns` lets the existing
    // `announce` path show the toast, deduped by `announced` like any other
    // run completion.
    if ("serviceWorker" in navigator) {
      const handlePushMessage = (e: MessageEvent) => {
        const payload = (e.data as { lociPush?: LociPushPayload } | undefined)?.lociPush;
        if (!payload?.sessionId || announced.has(payload.sessionId)) return;
        upsertRun(payload.sessionId, {
          phase: payload.status === "done" ? "complete" : "error",
          url: payload.url,
          city: payload.cityName,
          // Wording comes from the URL path (see watcher-rules.ts), so a
          // placeholder domain is enough here too.
          domain: "general",
        });
      };
      navigator.serviceWorker.addEventListener("message", handlePushMessage);
      onCleanup(() => navigator.serviceWorker.removeEventListener("message", handlePushMessage));
    }
  });

  return null;
}
