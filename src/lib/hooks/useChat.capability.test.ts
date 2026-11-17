// @vitest-environment happy-dom
//
// Which surfaces ask the server for hotel comparison reports. The chats built
// on useChat can draw the card and say so; a plain stream-service call, the
// kind the dashboard search box makes, does not, so the server answers it as
// it always has.
import { afterEach, describe, expect, it, vi } from "vitest";

const { streamChat } = vi.hoisted(() => ({ streamChat: vi.fn() }));

vi.mock("@/lib/api", () => ({ chatService: { streamChat } }));
vi.mock("@/lib/connect-transport", () => ({
  refreshSession: vi.fn(async () => false),
  transport: {},
}));
vi.mock("~/lib/analytics", () => ({ capture: vi.fn() }));
vi.mock("@tanstack/solid-query", async (original) => ({
  ...(await original<typeof import("@tanstack/solid-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
}));
vi.mock("~/contexts/LocationContext", () => ({
  useUserLocation: () => ({ userLocation: () => null }),
}));
vi.mock("~/lib/api/profiles", () => ({
  useDefaultSearchProfile: () => ({ data: { id: "profile-1" } }),
  useSearchProfiles: () => ({ data: [] }),
}));
vi.mock("~/lib/api/itineraries", () => ({
  useSaveItineraryMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/lib/api/llm", () => ({
  detectDomain: () => "general",
  useGetChatSessionsQuery: () => ({}),
}));
vi.mock("~/lib/api/authed-query", () => ({
  useAppQuery: () => ({ data: [], isError: false, isLoading: false }),
}));
vi.mock("~/lib/api/watches", () => ({
  browserTimeZone: () => "UTC",
  invalidateWatches: vi.fn(),
  toChatMessage: vi.fn(),
  watchApi: { propose: vi.fn() },
}));
vi.mock("~/lib/api/trips", () => ({
  rememberTrip: vi.fn(),
  tripKeys: { detail: (id: string) => ["trips", "detail", id], list: () => ["trips", "list"] },
}));

import { createRoot } from "solid-js";
import { create } from "@bufbuild/protobuf";
import {
  ClientCapability,
  StreamEventSchema,
  type ChatRequest,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { useChat } from "./useChat";
import { createStreamingSession, streamingService } from "~/lib/chat-stream";

const flush = () => new Promise((r) => setTimeout(r, 0));
const complete = () =>
  (async function* () {
    yield create(StreamEventSchema, {
      eventId: "e1",
      payload: { case: "complete", value: { sessionId: "" } },
    });
  })();
const sentRequest = () => streamChat.mock.calls[0][0] as ChatRequest;

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  streamChat.mockReset();
});

const mountChat = (opts: Parameters<typeof useChat>[0] = {}) =>
  createRoot((d) => {
    dispose = d;
    return useChat(opts);
  });

describe("who asks for hotel comparison reports", () => {
  it("a message sent from the chat page lists the capability", async () => {
    streamChat.mockReturnValue(complete());
    const chat = mountChat();
    chat.setCurrentMessage("which of these two hotels should I book?");
    await chat.sendMessage();
    await flush();
    expect(streamChat).toHaveBeenCalledTimes(1);
    expect(sentRequest().capabilities).toEqual([ClientCapability.HOTEL_COMPARISON]);
  });

  it("so does one from the trip chat (useChat bound to a trip, embedded)", async () => {
    streamChat.mockReturnValue(complete());
    const chat = mountChat({ tripId: () => "trip-1", embedded: true });
    chat.setCurrentMessage("compare these for my trip");
    await chat.sendMessage();
    await flush();
    expect(sentRequest().tripId).toBe("trip-1");
    expect(sentRequest().capabilities).toEqual([ClientCapability.HOTEL_COMPARISON]);
  });

  it("a plain stream-service call, as the dashboard search makes, does not", async () => {
    streamChat.mockReturnValue(complete());
    const session = createStreamingSession("general");
    session.query = "3 days in Lisbon";
    // The same params DeskHero passes: a profile, the message, a location.
    streamingService.startStream(
      {
        profileId: "profile-1",
        message: "3 days in Lisbon",
        userLocation: { userLat: 38.72, userLon: -9.14 },
      },
      { session, onProgress: vi.fn(), onComplete: vi.fn(), onError: vi.fn() },
    );
    await flush();
    expect(streamChat).toHaveBeenCalledTimes(1);
    expect(sentRequest().capabilities).toEqual([]);
  });
});
