import { describe, expect, it, vi } from "vitest";
import { createRoot } from "solid-js";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  AssistantEventSchema,
  DoneReason,
  type AssistantEvent,
} from "@buf/loci_loci-proto.bufbuild_es/loci/assistant/assistant_pb.js";
import type { AssistantApi, AskParams } from "../api/assistant";
import { createAssistantSession, type AskInput } from "./session";

const text = (t: string) =>
  create(AssistantEventSchema, { event: { case: "textDelta", value: { text: t } as never } });
const done = (conversationId = "conv-1") =>
  create(AssistantEventSchema, {
    event: {
      case: "done",
      value: { conversationId, reason: DoneReason.COMPLETE, degraded: false } as never,
    },
  });

const input: AskInput = { screen: { screen: "home", entities: [] } };

function setup(script: (params: AskParams, signal: AbortSignal) => AsyncIterable<AssistantEvent>) {
  const calls: AskParams[] = [];
  const api: AssistantApi = {
    ask(params, signal) {
      calls.push(params);
      return script(params, signal);
    },
    confirm: vi.fn(),
    dismiss: vi.fn(),
  };
  const speaker = { say: vi.fn(), stop: vi.fn() };
  const session = createRoot(() => createAssistantSession(api, speaker));
  return { session, speaker, calls };
}

async function* play(...events: AssistantEvent[]) {
  yield* events;
}

describe("createAssistantSession", () => {
  it("shows the answer and speaks it by sentence when asked by voice", async () => {
    const { session, speaker } = setup(() => play(text("Yes. It is"), text(" in May."), done()));
    await session.ask("when?", true, input);
    expect(session.turns()[0].reply).toBe("Yes. It is in May.");
    expect(speaker.say.mock.calls.map((c) => c[0])).toEqual(["Yes.", "It is in May."]);
    expect(session.asking()).toBe(false);
  });

  it("stays silent when typed, unless the speaker is on", async () => {
    const { session, speaker } = setup(() => play(text("Yes. "), done()));
    await session.ask("when?", false, input);
    expect(speaker.say).not.toHaveBeenCalled();

    session.setSpeakTyped(true);
    await session.ask("again?", false, input);
    expect(speaker.say).toHaveBeenCalledWith("Yes.");
  });

  it("carries the conversation on", async () => {
    const { session, calls } = setup(() => play(text("Yes."), done("conv-7")));
    await session.ask("one", false, input);
    await session.ask("two", false, input);
    expect(calls[0].conversationId).toBeUndefined();
    expect(calls[1].conversationId).toBe("conv-7");
  });

  it("ignores an empty question", async () => {
    const { session, calls } = setup(() => play(done()));
    await session.ask("   ", false, input);
    expect(calls).toHaveLength(0);
    expect(session.turns()).toHaveLength(0);
  });

  it("says when the feature is off", async () => {
    const { session } = setup(() => {
      // eslint-disable-next-line require-yield
      return (async function* () {
        throw new ConnectError("off", Code.Unimplemented);
      })();
    });
    await session.ask("hi", false, input);
    expect(session.turns()[0].failure).toMatch(/isn't available/);
    expect(session.turns()[0].offerChat).toBe(true);
  });

  it("turns an answered card into its note, or removes it", async () => {
    const handoff = (query: string) =>
      create(AssistantEventSchema, {
        event: { case: "handoff", value: { query, city: "" } as never },
      });
    const { session } = setup(() => play(handoff("a"), handoff("b"), done()));
    await session.ask("plan", false, input);
    const [first, second] = session.turns()[0].cards;

    session.settleCard(session.turns()[0].id, first.id, "Done.");
    session.settleCard(session.turns()[0].id, second.id);

    expect(session.turns()[0].cards).toEqual([{ kind: "note", id: first.id, text: "Done." }]);
  });

  it("says when the connection dropped part way, keeping what arrived", async () => {
    const { session } = setup(() => play(text("Part of")));
    await session.ask("hi", false, input);
    expect(session.turns()[0].reply).toBe("Part of");
    expect(session.turns()[0].failure).toMatch(/dropped/);
  });

  it("a new question stops the last answer and its voice", async () => {
    let aborted = false;
    const { session, speaker } = setup((params, signal) =>
      params.text === "slow"
        ? (async function* () {
            yield text("Thinking");
            await new Promise<void>((_, reject) =>
              signal.addEventListener("abort", () => {
                aborted = true;
                reject(new Error("aborted"));
              }),
            );
          })()
        : play(text("Fast."), done()),
    );
    const first = session.ask("slow", false, input);
    await new Promise((r) => setTimeout(r, 0));
    await session.ask("fast", false, input);
    await first;

    expect(aborted).toBe(true);
    expect(speaker.stop).toHaveBeenCalled();
    expect(session.turns()[0].failure).toBeUndefined();
    expect(session.turns()[0].reply).toBe("Thinking");
    expect(session.turns()[1].reply).toBe("Fast.");
    expect(session.asking()).toBe(false);
  });
});
