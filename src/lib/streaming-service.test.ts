// @vitest-environment happy-dom
//
// streamingService writes the completed session to sessionStorage, so this
// needs a DOM-ish environment for the same reason restore-session.test does.

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { LociStreamEvent } from "./streaming/chatStream";

// One controllable reader per test. Events are pushed in; the generator yields
// them until `end()` is called. This is the seam the service was built around,
// so nothing below touches Connect.
type Feed = {
  push: (e: LociStreamEvent) => void;
  end: () => void;
  aborted: () => boolean;
};

let currentFeed: Feed | null = null;
// Every request the service opened, in order: a reconnect is a second call.
let calls: Array<Record<string, unknown>> = [];

const { getRunStatuses } = vi.hoisted(() => ({ getRunStatuses: vi.fn() }));
vi.mock("./api/llm", () => ({ getRunStatuses }));

vi.mock("./streaming/chatStream", () => {
  return {
    streamChatEvents: (params: Record<string, unknown>, signal?: AbortSignal) => {
      calls.push(params);
      const queue: LociStreamEvent[] = [];
      let done = false;
      let wake: (() => void) | null = null;
      let aborted = false;
      signal?.addEventListener("abort", () => {
        aborted = true;
        wake?.();
      });
      currentFeed = {
        push: (e) => {
          queue.push(e);
          wake?.();
        },
        end: () => {
          done = true;
          wake?.();
        },
        aborted: () => aborted,
      };
      return (async function* () {
        while (true) {
          if (queue.length) {
            yield queue.shift()!;
            continue;
          }
          if (done || aborted) return;
          await new Promise<void>((r) => (wake = r));
          wake = null;
        }
      })();
    },
  };
});

import { streamingService, createStreamingSession } from "./streaming-service";
import { liveRuns, readActiveSessions, removeRun } from "./streaming/live-stream-store";
import { COMPLETED_SESSION_KEY, readCompletedSession } from "./streaming/restore-session";
import { reconnectPolicy } from "./streaming/reconnect";

const tick = () => new Promise((r) => setTimeout(r, 0));

const itineraryEvent = (): Extract<LociStreamEvent, { kind: "itinerary" }> => ({
  kind: "itinerary",
  cityResponse: {
    general_city_data: { city: "Funchal", country: "Portugal" } as any,
    points_of_interest: [{ name: "Monte Palace" } as any],
    itinerary_response: {
      itinerary_name: "Funchal in a day",
      overall_description: "",
      points_of_interest: [{ name: "Monte Palace" } as any],
    } as any,
    session_id: "s1",
  },
});

const emptyResult = () =>
  ({
    general_city_data: { city: "", country: "" },
    points_of_interest: [],
    itinerary_response: { itinerary_name: "", overall_description: "", points_of_interest: [] },
    session_id: "s1",
  }) as any;

function start(overrides: Partial<Parameters<typeof streamingService.startStream>[1]> = {}) {
  const session = createStreamingSession("itinerary");
  // Each run gets its own feed; capture the signal the service handed it.
  const manager = {
    session,
    onStart: vi.fn(),
    onProgress: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
  streamingService.startStream({ message: "Itinerary in Funchal" }, manager);
  return { session, manager, feed: currentFeed! };
}

beforeEach(async () => {
  // Abort whatever a previous test left open and let it settle before
  // wiping the store, so a late finalize cannot write into this test.
  streamingService.cleanup();
  await tick();
  for (const id of Object.keys(liveRuns)) removeRun(id);
  sessionStorage.clear();
  currentFeed = null;
  calls = [];
  getRunStatuses.mockReset();
  // No real waiting: backoff and poll intervals collapse to a tick.
  reconnectPolicy.backoffMs = [0, 0, 0];
  reconnectPolicy.pollIntervalMs = 0;
  reconnectPolicy.pollTimeoutMs = 50;
});

describe("streamingService → live store", () => {
  it("publishes the session on `start` and tells the caller once", async () => {
    const { manager, feed } = start();
    // A fresh search has no session id to key it by until `start`.
    expect(Object.keys(liveRuns)).toEqual([]);

    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary", city: "Funchal" });
    await tick();

    expect(liveRuns.s1.sessionId).toBe("s1");
    expect(liveRuns.s1.domain).toBe("itinerary");
    expect(liveRuns.s1.city).toBe("Funchal");
    expect(liveRuns.s1.phase).toBe("streaming");
    expect(liveRuns.s1.query).toBe("Itinerary in Funchal");
    expect(liveRuns.s1.source).toBe("service");
    expect(manager.onStart).toHaveBeenCalledTimes(1);
    expect((manager.onStart as Mock).mock.calls[0][0].sessionId).toBe("s1");

    feed.push({ kind: "progress", stage: "x" });
    await tick();
    expect(manager.onStart).toHaveBeenCalledTimes(1);
  });

  it("mirrors structured data into the store as it arrives", async () => {
    const { feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary" });
    feed.push(itineraryEvent());
    await tick();

    expect((liveRuns.s1.data as any)?.general_city_data?.city).toBe("Funchal");
    expect(liveRuns.s1.phase).toBe("streaming");
  });

  it("keeps the itinerary when `complete` carries an empty result", async () => {
    // The server's complete frame decodes to a zero-valued AiCityResponse
    // (only session_id set). Preferring it wiped the real data.
    const { session, feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary" });
    feed.push(itineraryEvent());
    feed.push({ kind: "complete", sessionId: "s1", result: emptyResult() });
    await tick();

    expect((session.data as any).general_city_data.city).toBe("Funchal");
    expect((liveRuns.s1.data as any).general_city_data.city).toBe("Funchal");
    expect(liveRuns.s1.phase).toBe("complete");
  });

  it("prefers a populated `complete` result", async () => {
    const { session, feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary" });
    feed.push(itineraryEvent());
    const full = { ...itineraryEvent().cityResponse };
    full.general_city_data = { ...full.general_city_data, city: "Lisbon" } as any;
    feed.push({ kind: "complete", sessionId: "s1", result: full });
    await tick();

    expect((session.data as any).general_city_data.city).toBe("Lisbon");
  });

  it("writes the completed session for the reload path, once, here", async () => {
    const { feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary" });
    feed.push(itineraryEvent());
    feed.push({ kind: "complete", sessionId: "s1" });
    await tick();

    const stored = JSON.parse(sessionStorage.getItem(COMPLETED_SESSION_KEY)!);
    expect(stored.sessionId).toBe("s1");
    expect(stored.data.general_city_data.city).toBe("Funchal");
  });

  it("marks the store failed on an error event", async () => {
    const { manager, feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary" });
    feed.push({ kind: "error", userMessage: "Nope.", internalCode: "x", retryable: true });
    await tick();

    expect(liveRuns.s1.phase).toBe("error");
    expect(liveRuns.s1.error).toBe("Nope.");
    expect(manager.onError).toHaveBeenCalledWith("Nope.");
  });

  it("runs a second search alongside the first, and keeps them apart", async () => {
    const first = start();
    first.feed.push({ kind: "start", sessionId: "s1", domain: "itinerary" });
    await tick();

    const second = start();
    await tick();
    expect(first.feed.aborted()).toBe(false);

    second.feed.push({ kind: "start", sessionId: "s2", domain: "accommodation" });
    await tick();

    expect(liveRuns.s1.domain).toBe("itinerary");
    expect(liveRuns.s2.domain).toBe("accommodation");
    // The first manager must not be finalized with the second's session.
    expect(first.manager.onComplete).not.toHaveBeenCalledWith(second.session);
    expect(second.session.isComplete).toBe(false);
  });

  it("streams two runs at once, stops one by id, and finishes the other", async () => {
    const a = start();
    const b = start();
    a.feed.push({ kind: "start", sessionId: "a", domain: "itinerary", eventId: "a1" });
    b.feed.push({ kind: "start", sessionId: "b", domain: "itinerary", eventId: "b1" });
    await tick();

    expect(liveRuns.a.phase).toBe("streaming");
    expect(liveRuns.b.phase).toBe("streaming");
    // Each run's own `start` event id is its resume token.
    expect(liveRuns.a.lastEventId).toBe("a1");
    expect(
      readActiveSessions()
        .map((e) => e.sessionId)
        .sort(),
    ).toEqual(["a", "b"]);

    streamingService.stop("a");
    await tick();
    expect(a.feed.aborted()).toBe(true);
    expect(b.feed.aborted()).toBe(false);
    // A stopped run did not finish: unlisted, envelope dropped, no toast.
    expect(liveRuns.a).toBeUndefined();
    expect(readActiveSessions().map((e) => e.sessionId)).toEqual(["b"]);

    b.feed.push(itineraryEvent());
    b.feed.push({ kind: "complete", sessionId: "b" });
    await tick();

    expect(liveRuns.b.phase).toBe("complete");
    expect(liveRuns.b.url.startsWith("/itinerary?sessionId=b")).toBe(true);
    expect(b.manager.onComplete).toHaveBeenCalledTimes(1);
  });

  it("lists a resume under its session id before the server replays", () => {
    const session = createStreamingSession("dining");
    session.sessionId = "r1";
    session.city = "Porto";
    streamingService.startStream(
      { message: "Dinner in Porto", sessionId: "r1", resumeToken: "e7" },
      { session, onProgress: vi.fn(), onComplete: vi.fn(), onError: vi.fn() },
    );

    expect(liveRuns.r1.phase).toBe("connecting");
    expect(liveRuns.r1.lastEventId).toBe("e7");
    expect(liveRuns.r1.url.startsWith("/restaurants?sessionId=r1")).toBe(true);
  });

  it("stops a run by its request id before the server names it", async () => {
    const mk = () => ({
      session: createStreamingSession("itinerary"),
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });
    streamingService.startStream({ message: "one", requestId: "req-1" }, mk());
    const one = currentFeed!;
    streamingService.startStream({ message: "two", requestId: "req-2" }, mk());
    const two = currentFeed!;

    streamingService.stop("req-1");
    await tick();
    expect(one.aborted()).toBe(true);
    expect(two.aborted()).toBe(false);
  });

  it("gives a run that never saw `start` a url when it finishes", async () => {
    const { feed } = start();
    feed.push(itineraryEvent());
    feed.push({ kind: "complete", sessionId: "s9" });
    await tick();

    expect(liveRuns.s9.phase).toBe("complete");
    expect(liveRuns.s9.url.startsWith("/itinerary?sessionId=s9")).toBe(true);
  });

  it("drops a finished run's resume envelope, so a reload does not announce it again", async () => {
    const { feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary", eventId: "e1" });
    feed.push(itineraryEvent());
    await tick();
    expect(readActiveSessions().map((e) => e.sessionId)).toEqual(["s1"]);

    feed.push({ kind: "complete", sessionId: "s1" });
    await tick();
    expect(liveRuns.s1.phase).toBe("complete");
    expect(readActiveSessions()).toEqual([]);
  });

  it("keeps a run that ended on an error event failed, and saves nothing", async () => {
    const { manager, feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary" });
    feed.push(itineraryEvent());
    feed.push({ kind: "error", userMessage: "Nope.", internalCode: "x", retryable: false });
    // streamChatEvents returns after yielding its error.
    feed.end();
    await tick();

    expect(liveRuns.s1.phase).toBe("error");
    expect(manager.onComplete).not.toHaveBeenCalled();
    expect(readCompletedSession("s1")).toBeNull();
    expect(sessionStorage.getItem(COMPLETED_SESSION_KEY)).toBeNull();
    expect(readActiveSessions()).toEqual([]);
  });

  it("hands a stopped run's partial answer to its caller without saving it", async () => {
    const { manager, feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary" });
    feed.push(itineraryEvent());
    await tick();

    streamingService.stop("s1");
    await tick();

    expect(manager.onComplete).toHaveBeenCalledTimes(1);
    expect(liveRuns.s1).toBeUndefined();
    expect(readCompletedSession("s1")).toBeNull();
    expect(sessionStorage.getItem(COMPLETED_SESSION_KEY)).toBeNull();
    expect(readActiveSessions()).toEqual([]);
  });

  it("records the page that hosts a run inline", async () => {
    const { feed } = start({ hostPath: "/chat" });
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary" });
    await tick();
    expect(liveRuns.s1.hostPath).toBe("/chat");
  });
});

// Production: the browser dropped three StreamChat requests at once, the server
// finished all three, and the client said "didn't finish". A transport error
// after `start` now resumes the same run instead of failing it.
describe("streamingService → reconnect", () => {
  const transportError = (): LociStreamEvent => ({
    kind: "error",
    userMessage: "Connection lost",
    internalCode: "Unknown",
    retryable: true,
    transport: true,
  });

  // Record every phase the run passes through, so "no error in between" is
  // checked on the way, not just at the end.
  const phasesOf = (id: string) => {
    const seen: string[] = [];
    const timer = setInterval(() => {
      const p = liveRuns[id]?.phase;
      if (p && seen.at(-1) !== p) seen.push(p);
    }, 0);
    return { seen, stop: () => clearInterval(timer) };
  };

  it("resumes with the last event id after a dropped connection, then completes", async () => {
    const { manager, feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary", eventId: "e1" });
    feed.push({ ...itineraryEvent(), eventId: "e2" });
    await tick();
    const phases = phasesOf("s1");

    feed.push(transportError());
    await tick();
    await tick();

    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ sessionId: "s1", resumeToken: "e2" });
    expect(liveRuns.s1.phase).toBe("streaming");
    expect(manager.onError).not.toHaveBeenCalled();

    currentFeed!.push({ kind: "complete", sessionId: "s1", eventId: "e3" });
    await tick();
    await tick();
    phases.stop();

    expect(liveRuns.s1.phase).toBe("complete");
    expect(phases.seen).not.toContain("error");
    expect(manager.onError).not.toHaveBeenCalled();
    expect(manager.onComplete).toHaveBeenCalledTimes(1);
    // The run the page is bound to is still the one it started: onStart once.
    expect(manager.onStart).toHaveBeenCalledTimes(1);
  });

  it("finishes a load_from_session resume with its url, and saves no partial result", async () => {
    const { manager, feed } = start();
    feed.push({
      kind: "start",
      sessionId: "s1",
      domain: "itinerary",
      city: "Porto",
      eventId: "e1",
    });
    await tick();
    feed.push(transportError());
    await tick();
    await tick();
    currentFeed!.push({ kind: "complete", sessionId: "s1", loadFromSession: true });
    await tick();
    await tick();

    expect(liveRuns.s1.phase).toBe("complete");
    expect(liveRuns.s1.url).toContain("/itinerary?sessionId=s1");
    expect(manager.onError).not.toHaveBeenCalled();
    expect(readCompletedSession("s1")).toBeNull();
  });

  it("polls the run's status after resume_lost, and completes with the server's url", async () => {
    getRunStatuses.mockResolvedValueOnce([
      { sessionId: "s1", status: "running", url: "", cityName: "Porto", domain: "" },
    ]);
    getRunStatuses.mockResolvedValue([
      {
        sessionId: "s1",
        status: "done",
        url: "/itinerary?sessionId=s1&cityName=Porto",
        cityName: "Porto",
        domain: "",
      },
    ]);
    const { manager, feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary", eventId: "e1" });
    await tick();
    const phases = phasesOf("s1");
    feed.push(transportError());
    await tick();
    await tick();
    currentFeed!.push({
      kind: "error",
      userMessage: "Still running elsewhere",
      internalCode: "resume_lost",
      retryable: true,
    });
    await vi.waitFor(() => expect(liveRuns.s1.phase).toBe("complete"));
    phases.stop();

    expect(getRunStatuses).toHaveBeenCalledWith(["s1"]);
    expect(liveRuns.s1.url).toBe("/itinerary?sessionId=s1&cityName=Porto");
    expect(phases.seen).not.toContain("error");
    expect(manager.onError).not.toHaveBeenCalled();
  });

  it("fails the run when polling says FAILED", async () => {
    getRunStatuses.mockResolvedValue([
      { sessionId: "s1", status: "failed", url: "", cityName: "", domain: "" },
    ]);
    const { manager, feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary", eventId: "e1" });
    await tick();
    feed.push(transportError());
    await tick();
    await tick();
    currentFeed!.push({
      kind: "error",
      userMessage: "lost",
      internalCode: "resume_lost",
      retryable: true,
    });
    await vi.waitFor(() => expect(liveRuns.s1.phase).toBe("error"));
    expect(manager.onError).toHaveBeenCalledTimes(1);
  });

  it("falls back to polling when every resume attempt drops too", async () => {
    getRunStatuses.mockResolvedValue([
      { sessionId: "s1", status: "done", url: "/itinerary?sessionId=s1", cityName: "", domain: "" },
    ]);
    const { feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary", eventId: "e1" });
    await tick();
    feed.push(transportError());
    for (let i = 0; i < 3; i++) {
      await vi.waitFor(() => expect(calls).toHaveLength(i + 2));
      currentFeed!.push(transportError());
    }
    await vi.waitFor(() => expect(liveRuns.s1.phase).toBe("complete"));
    // One original request plus three bounded resume attempts.
    expect(calls).toHaveLength(4);
  });

  it("keeps a transport error before `start` a failure: there is nothing to resume", async () => {
    const { manager, feed } = start();
    feed.push(transportError());
    await tick();
    await tick();
    expect(calls).toHaveLength(1);
    expect(manager.onError).toHaveBeenCalledTimes(1);
    expect(getRunStatuses).not.toHaveBeenCalled();
  });

  it("fails on a server StreamError without reconnecting", async () => {
    const { manager, feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary", eventId: "e1" });
    feed.push({
      kind: "error",
      userMessage: "The model failed",
      internalCode: "llm_failed",
      retryable: true,
    });
    await tick();
    await tick();
    expect(calls).toHaveLength(1);
    expect(liveRuns.s1.phase).toBe("error");
    expect(manager.onError).toHaveBeenCalledTimes(1);
  });

  it("does not reconnect a run the user stopped", async () => {
    reconnectPolicy.backoffMs = [20, 20, 20];
    const { manager, feed } = start();
    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary", eventId: "e1" });
    await tick();
    feed.push(transportError());
    await tick();
    streamingService.stop("s1");
    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toHaveLength(1);
    expect(manager.onError).not.toHaveBeenCalled();
    expect(liveRuns.s1).toBeUndefined();
  });
});
