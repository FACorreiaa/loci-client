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
// Per-call scripts, for tests that need a stream to stay open; falls back to
// `events` when empty.
let scripts: Array<(signal?: AbortSignal) => AsyncGenerator<LociStreamEvent>> = [];

vi.mock("../streaming/chatStream", () => ({
  streamChatEvents: (_params: unknown, signal?: AbortSignal) =>
    scripts.length
      ? scripts.shift()!(signal)
      : (async function* () {
          for (const e of events) yield e;
        })(),
}));

import { useChatRPC } from "./useChatRPC";
import { loadCompletedSession } from "../streaming/completed-sessions";
import { liveRuns, removeRun } from "../streaming/live-stream-store";

describe("useChatRPC — completed-session caching", () => {
  beforeEach(() => {
    sessionStorage.clear();
    for (const id of Object.keys(liveRuns)) removeRun(id);
    events = [];
    scripts = [];
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

  it("shows the server's concurrent-search refusal as the page error", async () => {
    const cap = "You have 3 searches running — wait for one to finish";
    events = [
      { kind: "error", userMessage: cap, internalCode: "ResourceExhausted", retryable: false },
    ];
    const { state, startStream } = useChatRPC();
    await startStream("hello", "Crete");

    expect(state.error).toBe(cap);
  });

  it("tells the page the run's id and lists the run under the page's own url", async () => {
    history.replaceState(null, "", "/hotels?message=cheap&cityName=Lisbon");
    events = [{ kind: "start", sessionId: "h1", domain: "accommodation" }];
    const onStart = vi.fn();
    const { startStream } = useChatRPC({ onStart });
    await startStream("cheap", "Lisbon");

    expect(onStart).toHaveBeenCalledWith("h1");
    expect(liveRuns.h1.url).toBe("/hotels?message=cheap&cityName=Lisbon&sessionId=h1");
    expect(liveRuns.h1.hostPath).toBe("/hotels?sessionId=h1");
  });

  it("aborts its previous stream when a new one starts, and unlists it", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let firstSignal: AbortSignal | undefined;
    scripts = [
      async function* (signal) {
        firstSignal = signal;
        yield { kind: "start", sessionId: "old", domain: "general" };
        await gate;
        // What a real aborted Connect stream yields: a terminal error.
        yield { kind: "error", userMessage: "aborted", internalCode: "Canceled", retryable: false };
      },
      async function* () {
        yield { kind: "start", sessionId: "new", domain: "general" };
        yield {
          kind: "general_pois",
          pois: [{ name: "Cafe" } as any],
          city: { city: "Lisbon" } as any,
          sessionId: "new",
        };
        yield { kind: "complete", sessionId: "new" };
      },
    ];
    const { state, startStream } = useChatRPC();
    const first = startStream("near me 50km", "nearme");
    await new Promise((r) => setTimeout(r, 0));
    expect(liveRuns.old.phase).toBe("streaming");

    await startStream("near me 10km", "nearme");
    expect(firstSignal?.aborted).toBe(true);
    release();
    await first;

    expect(liveRuns.old).toBeUndefined();
    expect(liveRuns.new.phase).toBe("complete");
    expect(state.error).toBeNull();
  });
});
