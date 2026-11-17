import {
  DoneReason,
  type AssistantEvent,
  type PlaceAction,
} from "@buf/loci_loci-proto.bufbuild_es/loci/assistant/assistant_pb.js";
import type { ActionProposal } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import type { HotelComparisonReport } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/hotel_report_pb.js";
import { isStayProposalFor } from "../chat/hotel-report-messages";
import type { StayAdded } from "../hotels/stay-from-report";

export type Card =
  | { kind: "trip"; id: string; proposal: ActionProposal; awaitsOwner: boolean }
  /**
   * A comparison of hotel links. `proposal` is the pick-one for its hotels,
   * when one of the caller's trips has the city; `added` once one is a stay.
   */
  | {
      kind: "hotel-report";
      id: string;
      report: HotelComparisonReport;
      proposal?: ActionProposal;
      added?: StayAdded;
    }
  | { kind: "place"; id: string; place: PlaceAction }
  | { kind: "handoff"; id: string; query: string; city?: string }
  /** What a card became once the person answered it. */
  | { kind: "note"; id: string; text: string };

/** One question and everything that came back for it. */
export interface Turn {
  id: number;
  you: string;
  reply: string;
  /** What the assistant is doing right now, written by the server. */
  status: string | null;
  cards: Card[];
  done: boolean;
  reason?: DoneReason;
  degraded: boolean;
  /** Why nothing could be sent or heard, for the person to read. */
  failure?: string;
  /** The assistant is switched off here, so point at the chat, which isn't. */
  offerChat?: boolean;
}

export const newTurn = (id: number, you: string): Turn => ({
  id,
  you,
  reply: "",
  status: null,
  cards: [],
  done: false,
  degraded: false,
});

/** The turn after one event. Pure, so a stream can be replayed in a test. */
export function applyEvent(turn: Turn, event: AssistantEvent): Turn {
  const e = event.event;
  switch (e.case) {
    case "textDelta":
      return { ...turn, reply: turn.reply + e.value.text, status: null };
    case "toolStatus":
      return { ...turn, status: e.value.label };
    case "proposal": {
      const kind = e.value.kind;
      if (kind.case === "trip") {
        const proposal = kind.value;
        // The report's own pick-one: it rides on the report card rather than
        // listing the same hotels a second time. One that waits for the
        // trip's owner stays a card of its own, where it can be taken back.
        const report = turn.cards.find(
          (c) => c.kind === "hotel-report" && isStayProposalFor(c.report, proposal),
        );
        if (report && !e.value.awaitsOwner) {
          return {
            ...turn,
            cards: turn.cards.map((c) => (c === report ? { ...c, proposal } : c)),
          };
        }
        const card: Card = {
          kind: "trip",
          id: kind.value.id,
          proposal: kind.value,
          awaitsOwner: e.value.awaitsOwner,
        };
        return { ...turn, cards: [...turn.cards, card] };
      }
      if (kind.case === "place") {
        const card: Card = { kind: "place", id: kind.value.id, place: kind.value };
        return { ...turn, cards: [...turn.cards, card] };
      }
      return turn;
    }
    case "hotelReport": {
      const id = `hotel-report-${e.value.id}`;
      if (turn.cards.some((c) => c.id === id)) return turn;
      const card: Card = { kind: "hotel-report", id, report: e.value };
      return { ...turn, cards: [...turn.cards, card], status: null };
    }
    case "handoff": {
      const card: Card = {
        kind: "handoff",
        id: `handoff-${turn.cards.length}`,
        query: e.value.query,
        city: e.value.city,
      };
      return { ...turn, cards: [...turn.cards, card] };
    }
    case "done":
      return {
        ...turn,
        done: true,
        status: null,
        reason: e.value.reason,
        degraded: e.value.degraded,
      };
    default:
      return turn;
  }
}

/** The line under an answer when something about it needs saying. */
export function closingNote(turn: Turn): string | null {
  if (turn.failure) return turn.failure;
  if (!turn.done) return null;
  switch (turn.reason) {
    case DoneReason.INTERRUPTED:
      return "That answer stopped part way.";
    case DoneReason.DAILY_LIMIT:
      return "That's all the questions for today. Ask again tomorrow.";
    case DoneReason.REFUSED:
      return "I can't help with that one.";
    case DoneReason.UNAVAILABLE:
      return "I can't answer right now. Try again in a moment.";
    default:
      return turn.degraded ? "I can't check your details or change anything right now." : null;
  }
}
