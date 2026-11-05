import {
  DoneReason,
  type AssistantEvent,
  type PlaceAction,
} from "@buf/loci_loci-proto.bufbuild_es/loci/assistant/assistant_pb.js";
import type { ActionProposal } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";

export type Card =
  | { kind: "trip"; id: string; proposal: ActionProposal; awaitsOwner: boolean }
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
