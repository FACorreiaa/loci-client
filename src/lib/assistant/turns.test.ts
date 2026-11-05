import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import {
  AssistantEventSchema,
  DoneReason,
  type AssistantEvent,
} from "@buf/loci_loci-proto.bufbuild_es/loci/assistant/assistant_pb.js";
import { applyEvent, closingNote, newTurn, type Turn } from "./turns";

const ev = (event: AssistantEvent["event"]) => create(AssistantEventSchema, { event });
const play = (...events: AssistantEvent[]): Turn => events.reduce(applyEvent, newTurn(1, "hi"));

const text = (t: string) => ev({ case: "textDelta", value: { text: t } as never });
const done = (reason: DoneReason, degraded = false) =>
  ev({ case: "done", value: { reason, degraded, conversationId: "c" } as never });

describe("applyEvent", () => {
  it("builds the answer from its pieces", () => {
    expect(play(text("Hel"), text("lo")).reply).toBe("Hello");
  });

  it("shows a status until words arrive", () => {
    const status = ev({ case: "toolStatus", value: { label: "Checking your trips" } as never });
    expect(play(status).status).toBe("Checking your trips");
    expect(play(status, text("Yes")).status).toBeNull();
  });

  it("collects cards in order", () => {
    const place = ev({
      case: "proposal",
      value: { kind: { case: "place", value: { id: "p", summary: "Save it" } } } as never,
    });
    const trip = ev({
      case: "proposal",
      value: {
        kind: { case: "trip", value: { id: "t", summary: "Move it" } },
        awaitsOwner: true,
      } as never,
    });
    const handoff = ev({
      case: "handoff",
      value: { query: "4 days in Rome", city: "Rome" } as never,
    });
    const cards = play(place, trip, handoff).cards;
    expect(cards.map((c) => c.kind)).toEqual(["place", "trip", "handoff"]);
    expect(cards[1].kind === "trip" && cards[1].awaitsOwner).toBe(true);
  });
});

describe("closingNote", () => {
  it("says nothing about a plain answer or one still arriving", () => {
    expect(closingNote(play(text("Yes")))).toBeNull();
    expect(closingNote(play(text("Yes"), done(DoneReason.COMPLETE)))).toBeNull();
  });

  it("says so when it could not check or change anything", () => {
    expect(closingNote(play(text("Yes"), done(DoneReason.COMPLETE, true)))).toMatch(/can't check/);
  });

  it("has a line for each way an answer can stop short", () => {
    for (const r of [
      DoneReason.INTERRUPTED,
      DoneReason.DAILY_LIMIT,
      DoneReason.REFUSED,
      DoneReason.UNAVAILABLE,
    ]) {
      expect(closingNote(play(done(r)))).toBeTruthy();
    }
  });
});
