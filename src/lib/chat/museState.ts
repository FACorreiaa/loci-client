// src/lib/chat/museState.ts
//
// The Muse chat header's avatar state and status line
// (apps/_reviews/muse-chat-contract.md, "Avatar states + status copy").
//
// Pure: a reducer over chat stream events (LociStreamEvent kinds) and a few UI
// events (send, composer focus/blur, the settle timer). The caller owns the
// timer — museSettleDelay says when to dispatch "settle" — so this module has
// no clocks, signals or DOM, and every transition is unit-testable.
//
// The status line reads after the agent's name: "Loci is thinking",
// "Loci found places", "Loci hit a snag". Idle is just "Ready".

import type { LociStreamEvent } from "~/lib/streaming/chatStream";

export type MusePhase = "idle" | "listening" | "working" | "celebrating" | "failed";

export interface MuseState {
  phase: MusePhase;
  status: string;
  /** Whether the composer has focus, so a settle can land on "listening". */
  focused: boolean;
}

/** Events that come from the page rather than the stream. */
export type MuseUiEvent =
  | { kind: "send" }
  | { kind: "focus" }
  | { kind: "blur" }
  | { kind: "settle" };

export type MuseInput = (Pick<LociStreamEvent, "kind"> & { stage?: string }) | MuseUiEvent;

export const MUSE_STATUS = {
  ready: "Ready",
  listening: "is listening",
  thinking: "is thinking",
  writing: "is writing",
  working: "is working on it",
  found: "found places",
  done: "is done",
  failed: "hit a snag",
} as const;

/** How long the celebration shows before the avatar settles (contract: 1.2s). */
export const MUSE_CELEBRATE_MS = 1200;
/** How long "hit a snag" stays before the header returns to idle. */
export const MUSE_FAILED_MS = 4000;
/** Longest progress stage the header is designed for (contract: ≤32 chars). */
export const MUSE_MAX_STAGE_LENGTH = 32;

export const initialMuseState: MuseState = {
  phase: "idle",
  status: MUSE_STATUS.ready,
  focused: false,
};

const RESULT_KINDS = new Set<string>([
  "itinerary",
  "hotels",
  "restaurants",
  "activities",
  "general_pois",
  "city_data",
]);

/**
 * The status line for a progress stage. The server sends a short human verb
 * phrase ("searching places"); anything that does not look like one — empty,
 * a raw code like "semantic_context_ready", the "progress" placeholder, or a
 * sentence too long for the header — falls back to "is working on it".
 */
export function progressStatus(stage: string | undefined): string {
  const s = (stage ?? "").trim().replace(/[.…]+$/, "");
  if (
    s === "" ||
    s.toLowerCase() === "progress" ||
    s.length > MUSE_MAX_STAGE_LENGTH ||
    /[_:{}[\]]/.test(s)
  ) {
    return MUSE_STATUS.working;
  }
  return `is ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
}

const working = (state: MuseState, status: string): MuseState =>
  state.phase === "working" && state.status === status
    ? state
    : { ...state, phase: "working", status };

const rest = (state: MuseState): MuseState =>
  state.focused
    ? { ...state, phase: "listening", status: MUSE_STATUS.listening }
    : { ...state, phase: "idle", status: MUSE_STATUS.ready };

export function nextMuseState(state: MuseState, input: MuseInput): MuseState {
  switch (input.kind) {
    case "send":
      // The composer is disabled while a reply streams, which drops focus
      // without a reliable blur event — so forget it here.
      return { phase: "working", status: MUSE_STATUS.thinking, focused: false };

    case "start":
      return working(state, MUSE_STATUS.thinking);

    case "token":
    case "partial":
      return working(state, MUSE_STATUS.writing);

    case "progress":
      return working(state, progressStatus(input.stage));

    case "complete":
      // The stream service finalizes a stream that ended on an error as
      // complete too; a snag must not turn into a celebration.
      return state.phase === "celebrating" || state.phase === "failed"
        ? state
        : { ...state, phase: "celebrating", status: MUSE_STATUS.done };

    case "error":
      return state.phase === "failed"
        ? state
        : { ...state, phase: "failed", status: MUSE_STATUS.failed };

    case "settle":
      return state.phase === "celebrating" || state.phase === "failed" ? rest(state) : state;

    case "focus": {
      const focused = { ...state, focused: true };
      return state.phase === "idle" ? rest(focused) : focused;
    }

    case "blur": {
      const blurred = { ...state, focused: false };
      return state.phase === "listening" ? rest(blurred) : blurred;
    }

    default:
      return RESULT_KINDS.has(input.kind) ? working(state, MUSE_STATUS.found) : state;
  }
}

/** Milliseconds until the caller should dispatch "settle", or null for none. */
export function museSettleDelay(phase: MusePhase): number | null {
  if (phase === "celebrating") return MUSE_CELEBRATE_MS;
  if (phase === "failed") return MUSE_FAILED_MS;
  return null;
}

/** Whether the avatar wears the working ring. */
export const museIsWorking = (state: MuseState): boolean => state.phase === "working";
