// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { getStreamingSession, setStreamingSession, updateStreamingData } from "./streaming-state";
import { persistActiveSession, readActiveSessions } from "./streaming/live-stream-store";

const env = (id: string) => ({
  sessionId: id,
  requestId: "r",
  lastEventId: "e1",
  query: "q",
  domain: "itinerary" as const,
  city: "Crete",
  startedAt: 1,
});

describe("legacy floating-chat streaming state", () => {
  beforeEach(() => sessionStorage.clear());

  it("leaves the run registry's resume envelopes intact", () => {
    persistActiveSession(env("a"));
    persistActiveSession(env("b"));

    // What FloatingChat's useChatSession does on `start` and on each event.
    setStreamingSession({
      sessionId: "chat-1",
      domain: "itinerary",
      city: "Crete",
      isComplete: false,
      data: { session_id: "chat-1" },
    });
    updateStreamingData({ general_city_data: { city: "Crete" } });

    expect(readActiveSessions()).toEqual([env("a"), env("b")]);
    expect(getStreamingSession()?.sessionId).toBe("chat-1");
  });
});
