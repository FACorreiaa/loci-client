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
import { liveStream, resetLiveStream } from "./streaming/live-stream-store";
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

beforeEach(() => {
  sessionStorage.clear();
  resetLiveStream();
  currentFeed = null;
});

describe("streamingService → live store", () => {
  it("publishes the session on `start` and tells the caller once", async () => {
    const { manager, feed } = start();
    expect(liveStream.phase).toBe("connecting");

    feed.push({ kind: "start", sessionId: "s1", domain: "itinerary", city: "Funchal" });
    await tick();

    expect(liveStream.sessionId).toBe("s1");
    expect(liveStream.domain).toBe("itinerary");
    expect(liveStream.city).toBe("Funchal");
    expect(liveStream.phase).toBe("streaming");
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

    expect((liveStream.data as any)?.general_city_data?.city).toBe("Funchal");
    expect(liveStream.phase).toBe("streaming");
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
    expect((liveStream.data as any).general_city_data.city).toBe("Funchal");
    expect(liveStream.phase).toBe("complete");
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

    expect(liveStream.phase).toBe("error");
    expect(liveStream.error).toBe("Nope.");
    expect(manager.onError).toHaveBeenCalledWith("Nope.");
  });

  it("aborts the previous stream when a new one starts, and keeps them apart", async () => {
    const first = start();
    first.feed.push({ kind: "start", sessionId: "s1", domain: "itinerary" });
    await tick();

    const second = start();
    await tick();
    expect(first.feed.aborted()).toBe(true);

    second.feed.push({ kind: "start", sessionId: "s2", domain: "accommodation" });
    await tick();

    expect(liveStream.sessionId).toBe("s2");
    expect(liveStream.domain).toBe("accommodation");
    // The first manager must not be finalized with the second's session.
    expect(first.manager.onComplete).not.toHaveBeenCalledWith(second.session);
    expect(second.session.isComplete).toBe(false);
  });
});
