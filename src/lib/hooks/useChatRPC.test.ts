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
// Every request opened, in order: a reconnect is a second call.
let calls: Array<Record<string, unknown>> = [];

const { getRunStatuses, getSessionList } = vi.hoisted(() => ({
  getRunStatuses: vi.fn(),
  getSessionList: vi.fn(),
}));
vi.mock("../api/llm", () => ({ getRunStatuses, getSessionList }));

vi.mock("../streaming/chatStream", () => ({
  streamChatEvents: (params: Record<string, unknown>, signal?: AbortSignal) => {
    calls.push(params);
    return scripts.length
      ? scripts.shift()!(signal)
      : (async function* () {
          for (const e of events) yield e;
        })();
  },
}));

import { useChatRPC } from "./useChatRPC";
import { loadCompletedSession } from "../streaming/completed-sessions";
import { liveRuns, removeRun } from "../streaming/live-stream-store";
import { reconnectPolicy } from "../streaming/reconnect";

describe("useChatRPC — completed-session caching", () => {
  beforeEach(() => {
    sessionStorage.clear();
    for (const id of Object.keys(liveRuns)) removeRun(id);
    events = [];
    scripts = [];
    calls = [];
    getRunStatuses.mockReset();
    getSessionList.mockReset();
    reconnectPolicy.backoffMs = [0, 0, 0];
    reconnectPolicy.pollIntervalMs = 0;
    reconnectPolicy.pollTimeoutMs = 50;
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

    // The city too, so a page opened with a bare message can still write it
    // into its URL.
    expect(onStart).toHaveBeenCalledWith("h1", "Lisbon");
    expect(liveRuns.h1.url).toBe("/hotels?message=cheap&cityName=Lisbon&sessionId=h1");
    expect(liveRuns.h1.hostPath).toBe("/hotels?sessionId=h1");
  });

  it("passes the search profile through to the stream request", async () => {
    events = [{ kind: "start", sessionId: "p1", domain: "accommodation" }];
    const { startStream } = useChatRPC();
    await startStream("cheap", "Lisbon", undefined, "profile-9");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      message: "cheap",
      cityName: "Lisbon",
      profileId: "profile-9",
    });
  });

  it("sends no profile when the page was opened without one", async () => {
    events = [{ kind: "start", sessionId: "p2", domain: "accommodation" }];
    const { startStream } = useChatRPC();
    await startStream("cheap", "Lisbon", undefined, "");

    expect((calls[0] as { profileId?: string }).profileId).toBeUndefined();
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

// A page-owned run (/hotels, /restaurants, /activities, /nearme) gets the same
// reconnect policy as the service's runs: a dropped connection resumes.
describe("useChatRPC — reconnect", () => {
  beforeEach(() => {
    sessionStorage.clear();
    for (const id of Object.keys(liveRuns)) removeRun(id);
    scripts = [];
    calls = [];
    getRunStatuses.mockReset();
    getSessionList.mockReset();
    reconnectPolicy.backoffMs = [0, 0, 0];
    reconnectPolicy.pollIntervalMs = 0;
    reconnectPolicy.pollTimeoutMs = 50;
  });

  const drop: LociStreamEvent = {
    kind: "error",
    userMessage: "Connection lost",
    internalCode: "Unknown",
    retryable: true,
    transport: true,
  };

  it("resumes a dropped stream with its last event id and finishes it", async () => {
    const phases: string[] = [];
    scripts = [
      async function* () {
        yield { kind: "start", sessionId: "h1", domain: "accommodation", eventId: "e1" };
        yield drop;
      },
      async function* () {
        phases.push(liveRuns.h1.phase);
        yield {
          kind: "hotels",
          pois: [{ name: "Pestana" } as any],
          city: { city: "Porto" } as any,
          sessionId: "h1",
          eventId: "e2",
        };
        yield { kind: "complete", sessionId: "h1", eventId: "e3" };
      },
    ];
    const onError = vi.fn();
    const { state, startStream } = useChatRPC({ onError });
    await startStream("hotels", "Porto");

    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ sessionId: "h1", resumeToken: "e1" });
    // Still streaming while it reconnected; never flagged failed.
    expect(phases).toEqual(["streaming"]);
    expect(onError).not.toHaveBeenCalled();
    expect(state.error).toBeNull();
    expect(liveRuns.h1.phase).toBe("complete");
    expect(state.streamedData?.hotels).toHaveLength(1);
  });

  it("settles by polling after resume_lost, with the server's url", async () => {
    getRunStatuses.mockResolvedValue([
      {
        sessionId: "h1",
        status: "done",
        url: "/hotels?sessionId=h1",
        cityName: "Porto",
        domain: "",
      },
    ]);
    getSessionList.mockResolvedValue({ city: { city: "Porto" }, pois: [{ name: "Pestana" }] });
    scripts = [
      async function* () {
        yield { kind: "start", sessionId: "h1", domain: "accommodation", eventId: "e1" };
        yield drop;
      },
      async function* () {
        yield { kind: "error", userMessage: "lost", internalCode: "resume_lost", retryable: true };
      },
    ];
    const { state, startStream } = useChatRPC();
    await startStream("hotels", "Porto");

    expect(liveRuns.h1.phase).toBe("complete");
    expect(liveRuns.h1.url).toBe("/hotels?sessionId=h1");
    expect(state.error).toBeNull();
    // The result was not on the stream: it is loaded from the session.
    expect(getSessionList).toHaveBeenCalledWith("h1", "hotels");
    expect(state.streamedData?.hotels).toHaveLength(1);
  });

  it("keeps a drop before `start` an error", async () => {
    scripts = [
      async function* () {
        yield drop;
      },
    ];
    const { state, startStream } = useChatRPC();
    await startStream("hotels", "Porto");
    expect(calls).toHaveLength(1);
    expect(state.error).toBeTruthy();
  });
});
