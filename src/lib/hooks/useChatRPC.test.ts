// @vitest-environment happy-dom
//
// useChatRPC used to cache every finished run, including a `complete` frame
// with no structured data behind it (no data event ever arrived, or the
// server sent a zero-valued result). A later restore then read that empty
// wrapper back as a successful result and rendered a permanently blank page.
// This is the seam streaming-service.test.ts was built around: mock
// streamChatEvents, feed it a fixed list of events, and assert on what lands
// in completed-sessions storage.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LociStreamEvent } from "../streaming/chatStream";

let events: LociStreamEvent[] = [];

vi.mock("../streaming/chatStream", () => ({
  streamChatEvents: async function* () {
    for (const e of events) yield e;
  },
}));

import { useChatRPC } from "./useChatRPC";
import { loadCompletedSession } from "../streaming/completed-sessions";
import { liveRuns, removeRun } from "../streaming/live-stream-store";

describe("useChatRPC — completed-session caching", () => {
  beforeEach(() => {
    sessionStorage.clear();
    for (const id of Object.keys(liveRuns)) removeRun(id);
    events = [];
  });

  it("does not cache a completed session with no content", async () => {
    events = [
      { kind: "start", sessionId: "empty-1", domain: "general" },
      { kind: "complete", sessionId: "empty-1" },
    ];
    const { startStream } = useChatRPC();
    await startStream("hello", "Nowhere");

    expect(loadCompletedSession("empty-1")).toBeNull();
  });

  it("caches a completed session that has content", async () => {
    events = [
      { kind: "start", sessionId: "full-1", domain: "activities" },
      {
        kind: "activities",
        pois: [{ name: "Knossos" } as any],
        city: { city: "Crete" } as any,
        sessionId: "full-1",
      },
      { kind: "complete", sessionId: "full-1" },
    ];
    const { startStream } = useChatRPC();
    await startStream("hello", "Crete");

    expect(loadCompletedSession("full-1")).toBeTruthy();
  });
});
