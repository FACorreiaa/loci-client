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

describe("hotel reports", () => {
  const report = (stayProposalId: string) =>
    ev({
      case: "hotelReport",
      value: {
        id: "r1",
        cityName: "Barcelona",
        stayProposalId,
        hotels: [{ stay: { cityName: "Barcelona", name: "Verdi 254" } }],
      } as never,
    });
  const tripProposal = (id: string, awaitsOwner = false, reportId = "r1") =>
    ev({
      case: "proposal",
      value: {
        kind: {
          case: "trip",
          value: {
            id,
            tripId: "t1",
            summary: "Pick where to stay.",
            action: { kind: { case: "chooseStay", value: { cityName: "Barcelona", reportId } } },
          },
        },
        awaitsOwner,
      } as never,
    });

  it("a report is a card of its own", () => {
    const cards = play(report("")).cards;
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe("hotel-report");
    expect(cards[0].kind === "hotel-report" && cards[0].proposal).toBeUndefined();
  });

  it("the trip proposal that follows is folded into the report card", () => {
    const cards = play(
      report("p1"),
      tripProposal("p1"),
      text("Verdi 254 is the better base."),
    ).cards;
    expect(cards.map((c) => c.kind)).toEqual(["hotel-report"]);
    expect(cards[0].kind === "hotel-report" && cards[0].proposal?.id).toBe("p1");
  });

  it("matches on the action's report id when the report names no proposal", () => {
    const cards = play(report(""), tripProposal("p5")).cards;
    expect(cards.map((c) => c.kind)).toEqual(["hotel-report"]);
    expect(cards[0].kind === "hotel-report" && cards[0].proposal?.id).toBe("p5");
  });

  it("an unrelated trip proposal, or one that waits for the owner, stays its own card", () => {
    expect(play(report("p1"), tripProposal("p2", false, "other")).cards.map((c) => c.kind)).toEqual(
      ["hotel-report", "trip"],
    );
    expect(play(report("p1"), tripProposal("p1", true)).cards.map((c) => c.kind)).toEqual([
      "hotel-report",
      "trip",
    ]);
  });

  it("a replayed report is not added twice", () => {
    expect(play(report("p1"), report("p1")).cards).toHaveLength(1);
  });
});
