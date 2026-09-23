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

vi.mock("./streaming/chatStream", () => {
  return {
    streamChatEvents: (_params: unknown, signal?: AbortSignal) => {
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
import { COMPLETED_SESSION_KEY } from "./streaming/restore-session";

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
});
