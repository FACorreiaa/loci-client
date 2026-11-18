import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { ActionProposalSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { HotelComparisonReportSchema } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/hotel_report_pb.js";
import type { ChatMessage } from "~/lib/hooks/useChat";
import type { LociStreamEvent } from "~/lib/streaming/chatStream";
import { foldHotelEvent, isFoldedProposal } from "./hotel-report-messages";

const report = (over = {}) =>
  create(HotelComparisonReportSchema, {
    id: "r1",
    cityName: "Barcelona",
    verdict: "Verdi 254.",
    stayProposalId: "p1",
    hotels: [{ stay: { cityName: "Barcelona", name: "Verdi 254" } }],
    ...over,
  });
const chooseStay = (id = "p1", reportId = "r1") =>
  create(ActionProposalSchema, {
    id,
    tripId: "t1",
    summary: "Pick where to stay in Barcelona.",
    action: { kind: { case: "chooseStay", value: { cityName: "Barcelona", reportId } } },
    options: [
      {
        label: "Verdi 254",
        choice: { case: "stay", value: { cityName: "Barcelona", name: "Verdi 254" } },
      },
    ],
  });
const setDates = create(ActionProposalSchema, {
  id: "p9",
  tripId: "t1",
  summary: "Set the dates.",
  action: { kind: { case: "setDates", value: { startDate: "2026-11-12", endDate: "2026-11-17" } } },
});

const play = (...events: LociStreamEvent[]) =>
  events.reduce<ChatMessage[]>((messages, e) => foldHotelEvent(messages, e), []);
const reported = (r = report()): LociStreamEvent => ({ kind: "hotel_comparison", report: r });
const proposed = (p = chooseStay()): LociStreamEvent => ({ kind: "action_proposal", proposal: p });

describe("foldHotelEvent", () => {
  it("a report becomes one hotel-report message", () => {
    const messages = play(reported());
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ id: "hotel-report-r1", type: "hotel-report" });
    expect(messages[0].hotelReport?.id).toBe("r1");
    expect(messages[0].stayProposal).toBeUndefined();
  });

  it("the proposal the report names rides on the report, not as a second card", () => {
    const messages = play(reported(), proposed());
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("hotel-report");
    expect(messages[0].stayProposal?.id).toBe("p1");
    expect(isFoldedProposal(messages, "p1")).toBe(true);
  });

  it("a report that names no proposal still takes the choose_stay made from it", () => {
    const messages = play(reported(report({ stayProposalId: "" })), proposed(chooseStay("p7")));
    expect(messages).toHaveLength(1);
    expect(messages[0].stayProposal?.id).toBe("p7");
  });

  it("any other proposal stays a trip-action card", () => {
    const messages = play(reported(), proposed(setDates));
    expect(messages.map((m) => m.type)).toEqual(["hotel-report", "trip-action"]);
    expect(messages[1].tripAction?.id).toBe("p9");
    expect(isFoldedProposal(messages, "p9")).toBe(false);
  });

  it("a choose_stay for another report is its own card", () => {
    const messages = play(reported(), proposed(chooseStay("p2", "other")));
    expect(messages.map((m) => m.type)).toEqual(["hotel-report", "trip-action"]);
  });

  it("a resumed stream that replays the turn adds nothing", () => {
    const once = play(reported(), proposed());
    const twice = [reported(), proposed()].reduce((m, e) => foldHotelEvent(m, e), once);
    expect(twice).toBe(once);
  });

  it("a proposal that arrived first is moved onto the report", () => {
    const messages = play(proposed(), reported());
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("hotel-report");
    expect(messages[0].stayProposal?.id).toBe("p1");
  });

  it("leaves the thread alone for every other event", () => {
    const before = play(reported());
    expect(foldHotelEvent(before, { kind: "progress", stage: "Reading the links" })).toBe(before);
  });
});
