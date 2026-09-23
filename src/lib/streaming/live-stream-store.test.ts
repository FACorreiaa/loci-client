// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearActiveSession,
  isLiveSession,
  liveRuns,
  persistActiveSession,
  readActiveSessions,
  removeRun,
  upsertRun,
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
});
