// Watches every run in the registry. When one ends while you are on some
// other page, it says so, with a way back. It also settles runs a reload
// interrupted, by resuming them or asking the server how they ended.
import { createEffect, on, onMount } from "solid-js";
import { useLocation } from "@solidjs/router";
import {
  clearActiveSession,
  liveRuns,
  readActiveSessions,
  upsertRun,
} from "~/lib/streaming/live-stream-store";
import { resumeAllLive } from "~/lib/streaming/resume-live";
import { getRunStatuses } from "~/lib/api/llm";
import { showToast } from "~/lib/toast-store";
import { isOnRunPage, runToast } from "~/lib/runs/watcher-rules";

export default function RunWatcher() {
  const location = useLocation();
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

  // onMount only fires after the component is actually mounted in the DOM,
  // which happens client-side only — SolidStart's SSR render never calls it,
  // so this is safe even though readActiveSessions/getRunStatuses touch
  // sessionStorage and the network.
  onMount(async () => {
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
  });

  return null;
}
