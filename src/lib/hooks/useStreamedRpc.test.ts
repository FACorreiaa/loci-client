// @vitest-environment happy-dom
//
// The itinerary page's own search (and the toast's Retry, which lands there)
// used to abort in onCleanup and never register the run: walking away killed
// it client-side with no toast. It now runs on the shared service, which
// outlives the page and lists the run like every other.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "solid-js";
import type { LociStreamEvent } from "../streaming/chatStream";

type Feed = { push: (e: LociStreamEvent) => void; signal?: AbortSignal };
let feed: Feed | null = null;
let calls: Array<Record<string, unknown>> = [];

vi.mock("../api/llm", () => ({ getRunStatuses: vi.fn(), getSessionList: vi.fn() }));
vi.mock("../streaming/chatStream", () => ({
  streamChatEvents: (params: Record<string, unknown>, signal?: AbortSignal) => {
    calls.push(params);
    const queue: LociStreamEvent[] = [];
    let wake: (() => void) | null = null;
    signal?.addEventListener("abort", () => wake?.());
    feed = {
      signal,
      push: (e) => {
        queue.push(e);
        wake?.();
      },
    };
    return (async function* () {
      while (!signal?.aborted) {
        if (queue.length) {
          const e = queue.shift()!;
          yield e;
          if (e.kind === "complete" || e.kind === "error") return;
          continue;
        }
        await new Promise<void>((r) => (wake = r));
        wake = null;
      }
    })();
  },
}));

import { useStreamedRpc } from "./useStreamedRpc";
import { streamingService } from "../streaming-service";
import { liveRuns, removeRun } from "../streaming/live-stream-store";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("useStreamedRpc", () => {
  beforeEach(async () => {
    streamingService.cleanup();
    await tick();
    for (const id of Object.keys(liveRuns)) removeRun(id);
    sessionStorage.clear();
    feed = null;
    calls = [];
  });

  it("keeps streaming after the page unmounts, and lists the run", async () => {
    const onStart = vi.fn();
    let hook!: ReturnType<typeof useStreamedRpc>;
    const dispose = createRoot((dispose) => {
      hook = useStreamedRpc(
        () => "3 days in Porto",
        () => "Porto",
        () => "p1",
        { onStart },
      );
      return dispose;
    });
    void hook.connect();
    expect(calls[0]).toMatchObject({
      message: "3 days in Porto",
      cityName: "Porto",
      profileId: "p1",
    });

    feed!.push({
      kind: "start",
      sessionId: "it1",
      domain: "itinerary",
      city: "Porto",
      eventId: "e1",
    });
    await tick();
    expect(onStart).toHaveBeenCalledWith("it1");

    // Leaving the page.
    dispose();
    await tick();
    expect(feed!.signal?.aborted).toBe(false);

    const run = liveRuns.it1;
    expect(run.phase).toBe("streaming");
    expect(run.query).toBe("3 days in Porto");
    expect(run.url).toContain("/itinerary?sessionId=it1");
    expect(run.hostPath).toBe("/itinerary?sessionId=it1");

    feed!.push({
      kind: "itinerary",
      eventId: "e2",
      cityResponse: {
        general_city_data: { city: "Porto" } as any,
        points_of_interest: [{ name: "Ribeira" } as any],
        session_id: "it1",
      } as any,
    });
    feed!.push({ kind: "complete", sessionId: "it1", tripId: "t9", eventId: "e3" });
    await tick();
    await tick();

    // The toast fires from this: the run finished, and says where.
    expect(liveRuns.it1.phase).toBe("complete");
    expect(hook.store.data?.general_city_data?.city).toBe("Porto");
    expect(hook.store.tripId).toBe("t9");
    expect(hook.store.isLoading).toBe(false);
  });

  it("surfaces a server error on its store", async () => {
    const onError = vi.fn();
    const { store, connect } = useStreamedRpc(
      () => "3 days in Porto",
      () => "Porto",
      () => "",
      { onError },
    );
    void connect();
    feed!.push({ kind: "start", sessionId: "it2", domain: "itinerary", eventId: "e1" });
    feed!.push({ kind: "error", userMessage: "No luck", internalCode: "llm", retryable: false });
    await tick();
    await tick();
    expect(store.error?.message).toBe("No luck");
    expect(store.isLoading).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(liveRuns.it2.phase).toBe("error");
  });
});
