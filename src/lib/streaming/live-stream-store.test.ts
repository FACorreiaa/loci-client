// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearActiveSession,
  isLiveSession,
  liveRuns,
  MAX_FINISHED_RUNS,
  persistActiveSession,
  readActiveSessions,
  removeRun,
  upsertRun,
  useLiveSession,
} from "./live-stream-store";

const env = (id: string) => ({
  sessionId: id,
  requestId: "r",
  lastEventId: "",
  query: "q",
  domain: "itinerary" as const,
  city: "Crete",
  startedAt: 1,
});

describe("run registry", () => {
  beforeEach(() => {
    for (const id of Object.keys(liveRuns)) removeRun(id);
    clearActiveSession();
  });

  it("tracks several runs at once", () => {
    upsertRun("a", { phase: "streaming", domain: "itinerary", city: "Crete" });
    upsertRun("b", { phase: "streaming", domain: "dining", city: "Porto" });
    expect(isLiveSession("a")).toBe(true);
    expect(isLiveSession("b")).toBe(true);
    upsertRun("a", { phase: "complete" });
    expect(liveRuns.b.phase).toBe("streaming");
  });

  it("persists one envelope per run and survives a reload", () => {
    persistActiveSession(env("a"));
    persistActiveSession(env("b"));
    persistActiveSession({ ...env("a"), lastEventId: "e9" });
    const all = readActiveSessions();
    expect(all.map((e) => e.sessionId).sort()).toEqual(["a", "b"]);
    expect(all.find((e) => e.sessionId === "a")?.lastEventId).toBe("e9");
    clearActiveSession("a");
    expect(readActiveSessions().map((e) => e.sessionId)).toEqual(["b"]);
  });

  it("reads an old single-envelope value", () => {
    sessionStorage.setItem("active_streaming_session", JSON.stringify(env("old")));
    expect(readActiveSessions().map((e) => e.sessionId)).toEqual(["old"]);
  });

  it("binds a page only to a run that is streaming or finished with content", () => {
    upsertRun("streaming", { phase: "streaming" });
    upsertRun("connecting", { phase: "connecting" });
    // What a reload's GetRunStatus settle or a relayed push used to write:
    // a finished phase with nothing behind it. Binding to it rendered blank.
    upsertRun("empty", { phase: "complete", data: null });
    upsertRun("failed", { phase: "error", error: "Nope." });
    upsertRun("full", {
      phase: "complete",
      data: { general_city_data: { city: "Crete" } } as any,
    });
    expect(isLiveSession("streaming")).toBe(true);
    expect(isLiveSession("connecting")).toBe(true);
    expect(isLiveSession("empty")).toBe(false);
    expect(isLiveSession("failed")).toBe(false);
    expect(isLiveSession("full")).toBe(true);
    expect(isLiveSession("missing")).toBe(false);
  });

  it("keeps showing a bound page how its run ended, even an empty finish", () => {
    upsertRun("a", { phase: "streaming" });
    const live = useLiveSession(() => "a");
    expect(live.isLive()).toBe(true);
    upsertRun("a", { phase: "complete", data: null });
    expect(live.phase()).toBe("complete");
    upsertRun("a", { phase: "error", error: "Nope." });
    expect(live.error()).toBe("Nope.");
  });

  it("drops the oldest finished runs past the cap, never a streaming one", () => {
    upsertRun("live", { phase: "streaming", startedAt: 0 });
    for (let i = 1; i <= MAX_FINISHED_RUNS + 2; i++) {
      upsertRun(`done-${i}`, { phase: "complete", startedAt: i });
    }
    const finished = Object.values(liveRuns).filter((r) => r.phase === "complete");
    expect(finished).toHaveLength(MAX_FINISHED_RUNS);
    expect(liveRuns["done-1"]).toBeUndefined();
    expect(liveRuns["done-2"]).toBeUndefined();
    expect(liveRuns[`done-${MAX_FINISHED_RUNS + 2}`]).toBeDefined();
    expect(liveRuns.live.phase).toBe("streaming");
  });
});
