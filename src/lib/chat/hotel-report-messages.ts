// How a hotel comparison turn lands in a chat thread: the report becomes one
// message, and the choose_stay proposal that follows it is attached to that
// message rather than drawn as a second card saying the same hotels again.
import type { ActionProposal, LociStreamEvent } from "~/lib/streaming/chatStream";
import type { HotelComparisonReport } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/hotel_report_pb.js";
import type { ChatMessage } from "~/lib/hooks/useChat";

export const hotelReportMessageId = (reportId: string) => `hotel-report-${reportId}`;
export const tripActionMessageId = (proposalId: string) => `trip-action-${proposalId}`;

/** Whether `proposal` is the pick-one for `report`'s hotels. */
export function isStayProposalFor(report: HotelComparisonReport, proposal: ActionProposal) {
  if (report.stayProposalId) return report.stayProposalId === proposal.id;
  const kind = proposal.action?.kind;
  return kind?.case === "chooseStay" && !!report.id && kind.value.reportId === report.id;
}

/**
 * The thread after a report or a proposal event; the same array when the event
 * changes nothing (any other kind, or one a resumed stream replayed).
 */
export function foldHotelEvent(
  messages: ChatMessage[],
  event: LociStreamEvent,
  now: Date = new Date(),
): ChatMessage[] {
  if (event.kind === "hotel_comparison") {
    const id = hotelReportMessageId(event.report.id);
    if (messages.some((m) => m.id === id)) return messages;
    // Out of order is not expected, but a proposal that got here first still
    // belongs on the report.
    const early = messages.find(
      (m) =>
        m.type === "trip-action" && m.tripAction && isStayProposalFor(event.report, m.tripAction),
    );
    return [
      ...messages.filter((m) => m !== early),
      {
        id,
        type: "hotel-report",
        content: event.report.verdict || "Hotel comparison",
        timestamp: now,
        hotelReport: event.report,
        stayProposal: early?.tripAction,
      },
    ];
  }
  if (event.kind === "action_proposal") {
    const proposal = event.proposal;
    const report = messages.find(
      (m) =>
        m.type === "hotel-report" && m.hotelReport && isStayProposalFor(m.hotelReport, proposal),
    );
    if (report) {
      if (report.stayProposal?.id === proposal.id) return messages;
      return messages.map((m) => (m === report ? { ...m, stayProposal: proposal } : m));
    }
    const id = tripActionMessageId(proposal.id);
    if (messages.some((m) => m.id === id)) return messages;
    return [
      ...messages,
      { id, type: "trip-action", content: proposal.summary, timestamp: now, tripAction: proposal },
    ];
  }
  return messages;
}

/** Whether the proposal is drawn inside a report message rather than as its own card. */
export const isFoldedProposal = (messages: ChatMessage[], proposalId: string) =>
  messages.some((m) => m.type === "hotel-report" && m.stayProposal?.id === proposalId);
