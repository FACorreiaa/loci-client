import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  ConversationMessageSchema,
  MessageOrigin,
  MessageRole,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { originOf, toChatMessage, watchErrorMessage } from "./watches";

describe("originOf", () => {
  it("reads UNSPECIFIED (older rows) and REPLY as a reply", () => {
    expect(originOf(MessageOrigin.UNSPECIFIED)).toBe("reply");
    expect(originOf(MessageOrigin.REPLY)).toBe("reply");
    expect(originOf(undefined)).toBe("reply");
  });
  it("reads PROACTIVE as proactive", () => {
    expect(originOf(MessageOrigin.PROACTIVE)).toBe("proactive");
  });
});

describe("toChatMessage", () => {
  it("turns CreateWatch's confirmation into a captioned agent bubble", () => {
    const msg = toChatMessage(
      create(ConversationMessageSchema, {
        id: "c1",
        role: MessageRole.ASSISTANT,
        content: "Got it — I'll watch rain in Lisbon.",
        timestamp: { seconds: 1_790_000_000n, nanos: 0 },
        origin: MessageOrigin.PROACTIVE,
        sourceLabel: "Standing task",
      }),
    );
    expect(msg).toMatchObject({
      id: "c1",
      type: "assistant",
      content: "Got it — I'll watch rain in Lisbon.",
      origin: "proactive",
      sourceLabel: "Standing task",
    });
    expect(msg.timestamp.getTime()).toBe(1_790_000_000_000);
  });
});

describe("watchErrorMessage", () => {
  const err = (code: Code) => new ConnectError("raw", code);
  it("gives each WatchService code its own copy", () => {
    expect(watchErrorMessage(err(Code.ResourceExhausted), "create")).toMatch(/10 standing tasks/);
    expect(watchErrorMessage(err(Code.Unauthenticated), "delete")).toMatch(/Sign in again/);
    expect(watchErrorMessage(err(Code.NotFound), "delete")).toMatch(/already removed/);
    expect(watchErrorMessage(err(Code.NotFound), "create")).toMatch(/isn't saved yet/);
    expect(watchErrorMessage(err(Code.InvalidArgument), "create")).toMatch(/as written/);
  });
  it("never shows the raw server message", () => {
    for (const code of [Code.InvalidArgument, Code.Internal, Code.NotFound]) {
      expect(watchErrorMessage(err(code), "create")).not.toContain("raw");
    }
  });
});
