// The 4th concurrent search is refused with ResourceExhausted and a message
// written for people. It used to be reworded as "AI service is busy. Please
// try again in 60 seconds." and marked retryable, so the cap was never shown.
import { describe, expect, it, vi } from "vitest";
import { Code, ConnectError } from "@connectrpc/connect";

const { streamChat } = vi.hoisted(() => ({ streamChat: vi.fn() }));

vi.mock("@/lib/api", () => ({ chatService: { streamChat } }));
vi.mock("@/lib/connect-transport", () => ({
  refreshSession: vi.fn(async () => false),
  transport: {},
}));
vi.mock("~/lib/analytics", () => ({ capture: vi.fn() }));

import { create } from "@bufbuild/protobuf";
import { StreamEventSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { mapProtoEvent, streamChatEvents, terminalError } from "./chatStream";

const CAP = "You have 3 searches running — wait for one to finish";

// An async iterable whose first next() rejects, the way a refused stream does.
const failWith = (err: unknown) =>
  streamChat.mockReturnValue({
    [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(err) }),
  });

describe("chatStream terminal errors", () => {
  it("passes the cap refusal through verbatim, not retryable", async () => {
    failWith(new ConnectError(CAP, Code.ResourceExhausted));
    const events = [];
    for await (const e of streamChatEvents({ message: "Crete" })) events.push(e);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "error",
      userMessage: CAP,
      internalCode: "ResourceExhausted",
      retryable: false,
    });
  });

  it("still words a quota refusal through parseStreamError", () => {
    const e = terminalError(
      new ConnectError("daily free quota exhausted (plan free)", Code.ResourceExhausted),
      null,
    );
    expect(e.userMessage).toMatch(/free requests/);
  });

  it("keeps an upstream rate limit retryable", () => {
    const e = terminalError(
      new ConnectError("rate limit, retry in 5s", Code.ResourceExhausted),
      null,
    );
    expect(e.retryable).toBe(true);
    expect(e.userMessage).toMatch(/busy/);
  });
});

// A dropped connection is not a failed search: the server keeps generating
// after the client goes away. streamChatEvents marks errors that came from
// the transport so callers can resume instead of declaring the run failed.
describe("chatStream transport classification", () => {
  const frame = (init: Parameters<typeof create<typeof StreamEventSchema>>[1]) =>
    create(StreamEventSchema, init);

  // Yields `frames`, then fails with `err` (or ends cleanly when undefined).
  const script = (frames: ReturnType<typeof frame>[], err?: unknown) =>
    streamChat.mockImplementation(() =>
      (async function* () {
        for (const f of frames) yield f;
        if (err !== undefined) throw err;
      })(),
    );

  const collect = async (signal?: AbortSignal) => {
    const out = [];
    for await (const e of streamChatEvents({ message: "Porto" }, signal)) out.push(e);
    return out;
  };

  const start = frame({
    eventId: "e1",
    payload: { case: "start", value: { sessionId: "s1", cityName: "Porto" } },
  });

  it.each([
    ["Unavailable", new ConnectError("upstream connect error", Code.Unavailable)],
    ["Unknown", new ConnectError("network error", Code.Unknown)],
    ["Internal", new ConnectError("protocol error: missing EndStreamResponse", Code.Internal)],
  ])("marks a ConnectError %s mid-stream as transport", async (_name, err) => {
    script([start], err);
    const events = await collect();
    expect(events.at(-1)).toMatchObject({ kind: "error", transport: true, retryable: true });
  });

  it("marks a fetch TypeError as transport", async () => {
    script([], new TypeError("Failed to fetch"));
    const events = await collect();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "error", transport: true });
  });

  it("reports a stream that ends without a terminal event as a transport error", async () => {
    script([start]);
    const events = await collect();
    expect(events.map((e) => e.kind)).toEqual(["start", "error"]);
    expect(events[1]).toMatchObject({ kind: "error", transport: true });
  });

  it("does not add anything after a stream that ended on `complete`", async () => {
    script([
      start,
      frame({ eventId: "e2", payload: { case: "complete", value: { sessionId: "s1" } } }),
    ]);
    const events = await collect();
    expect(events.map((e) => e.kind)).toEqual(["start", "complete"]);
  });

  it("never marks a server-sent StreamError", async () => {
    script([
      start,
      frame({
        eventId: "e2",
        payload: {
          case: "error",
          value: { userMessage: "The model failed", internalCode: "llm_failed", retryable: true },
        },
      }),
    ]);
    const events = await collect();
    const err = events.at(-1)!;
    expect(err).toMatchObject({ kind: "error", internalCode: "llm_failed" });
    expect((err as { transport?: boolean }).transport).toBeFalsy();
  });

  it("does not treat our own abort as transport", async () => {
    const ctrl = new AbortController();
    streamChat.mockImplementation(() =>
      (async function* () {
        yield start;
        ctrl.abort();
        throw new ConnectError("operation was aborted", Code.Canceled);
      })(),
    );
    const events = await collect(ctrl.signal);
    for (const e of events) expect((e as { transport?: boolean }).transport).toBeFalsy();
  });

  it("does not mark the concurrent-search cap as transport", async () => {
    script([], new ConnectError(CAP, Code.ResourceExhausted));
    const [e] = await collect();
    expect((e as { transport?: boolean }).transport).toBeFalsy();
  });

  it("carries load_from_session on a resume's complete", () => {
    const e = mapProtoEvent(
      frame({ payload: { case: "complete", value: { sessionId: "s1", loadFromSession: true } } }),
    );
    expect(e).toMatchObject({ kind: "complete", sessionId: "s1", loadFromSession: true });
  });
});
