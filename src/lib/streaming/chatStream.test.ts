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

import { streamChatEvents, terminalError } from "./chatStream";

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
