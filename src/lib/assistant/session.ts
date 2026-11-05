import { batch, createSignal } from "solid-js";
import { Code, ConnectError } from "@connectrpc/connect";
import type { AssistantApi, AskParams } from "../api/assistant";
import { SentenceChunker } from "./sentences";
import { applyEvent, newTurn, type Card, type Turn } from "./turns";

/** What the session needs from speech, so a test can listen in. */
export interface Speaker {
  say(text: string): void;
  stop(): void;
}

export type AskInput = Pick<AskParams, "screen" | "latitude" | "longitude">;

/**
 * One open overlay's conversation. It owns its own stream, so nothing here can
 * disturb a search running in the planner.
 */
export function createAssistantSession(api: AssistantApi, speaker: Speaker) {
  const [turns, setTurns] = createSignal<Turn[]>([]);
  const [asking, setAsking] = createSignal(false);
  const [speakTyped, setSpeakTyped] = createSignal(false);
  let conversationId: string | undefined;
  let inflight: AbortController | null = null;
  let nextId = 1;

  const update = (id: number, change: (t: Turn) => Turn) =>
    setTurns((all) => all.map((t) => (t.id === id ? change(t) : t)));

  const ask = async (text: string, voice: boolean, input: AskInput) => {
    const question = text.trim();
    if (!question) return;
    stop();

    const ctrl = new AbortController();
    inflight = ctrl;
    const id = nextId++;
    batch(() => {
      setTurns((all) => [...all, newTurn(id, question)]);
      setAsking(true);
    });

    const aloud = voice || speakTyped();
    const chunker = new SentenceChunker();
    const speak = (pieces: string[]) => {
      if (aloud) for (const piece of pieces) speaker.say(piece);
    };

    try {
      const params = { ...input, conversationId, text: question, voice };
      for await (const event of api.ask(params, ctrl.signal)) {
        if (event.event.case === "textDelta") speak(chunker.push(event.event.value.text));
        if (event.event.case === "done" && event.event.value.conversationId) {
          conversationId = event.event.value.conversationId;
        }
        update(id, (t) => applyEvent(t, event));
      }
      speak(chunker.flush());
      // A stream that ends without a Done lost its connection part way.
      update(id, (t) => (t.done ? t : { ...t, done: true, failure: "The connection dropped." }));
    } catch (err) {
      if (!ctrl.signal.aborted) {
        update(id, (t) => ({
          ...t,
          done: true,
          status: null,
          failure: failureFor(err),
          offerChat: err instanceof ConnectError && err.code === Code.Unimplemented,
        }));
      }
    } finally {
      if (inflight === ctrl) {
        inflight = null;
        setAsking(false);
      }
    }
  };

  /** Stops the answer and the voice. What has arrived stays on screen. */
  const stop = () => {
    inflight?.abort();
    inflight = null;
    speaker.stop();
    setAsking(false);
    setTurns((all) => all.map((t) => (t.done ? t : { ...t, done: true, status: null })));
  };

  /** A card has been answered: it becomes the note, or goes if there is none. */
  const settleCard = (turnId: number, cardId: string, note?: string) =>
    update(turnId, (t) => ({
      ...t,
      cards: t.cards.flatMap((c): Card[] => {
        if (c.id !== cardId) return [c];
        return note ? [{ kind: "note", id: c.id, text: note }] : [];
      }),
    }));

  return { turns, asking, ask, stop, settleCard, speakTyped, setSpeakTyped };
}

function failureFor(err: unknown): string {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.Unimplemented:
        return "Ask Loci isn't available yet. The chat still is.";
      case Code.Unauthenticated:
        return "Sign in again to ask.";
    }
  }
  return "I couldn't reach Loci. Try again.";
}
