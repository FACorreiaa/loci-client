import { createSignal, onCleanup, onMount } from "solid-js";
import { canRecord, RecorderError, startRecording, type Recorder } from "~/lib/audio/recorder";
import { transcribe, TranscribeError } from "~/lib/api/speech";

export type DictationState = "idle" | "recording" | "transcribing";

/**
 * What kind of thing went wrong, for code that acts on it rather than showing it.
 *
 * "unavailable" is the server having no working speech service. It is the one
 * that decides whether a microphone should be offered again, because trying
 * again will not help. A browser without a microphone is "no-microphone", not
 * this: that one is about the device, not the deployment.
 */
export type DictationErrorKind = "unavailable" | "denied" | "no-microphone" | "silent" | "failed";

export interface Dictation {
  /**
   * Whether this browser can record.
   *
   * False until the component has mounted, even where it will turn out to be
   * true. The server renders no microphone because it has no navigator, and a
   * client that rendered one immediately would disagree with the markup it is
   * hydrating. So it appears a tick later instead, which nobody sees.
   */
  supported: () => boolean;
  state: () => DictationState;
  /** What went wrong, for the person to read. Cleared when they try again. */
  error: () => string | null;
  /** The kind of {@link error}, or null when there is none. */
  errorKind: () => DictationErrorKind | null;
  /** Starts recording, or stops and transcribes if already recording. */
  toggle: () => void;
  /** Abandons a recording without transcribing it. */
  cancel: () => void;
}

/**
 * Dictation for a text box.
 *
 * The transcript is handed back rather than sent. Speech recognition mangles
 * place names — "Cais do Sodré" comes back as "Case 2 Soda" without help — and
 * a wrong place produces a confident itinerary for somewhere that does not
 * exist. The server sends the account's own place names as a hint, which fixes
 * most of it; putting the words in the box fixes the rest, in the second it
 * takes. That is the part a chat platform cannot offer.
 */
export function useDictation(onTranscript: (text: string) => void): Dictation {
  const [state, setState] = createSignal<DictationState>("idle");
  const [problem, setProblem] = createSignal<{ message: string; kind: DictationErrorKind } | null>(
    null,
  );
  const error = () => problem()?.message ?? null;
  const errorKind = () => problem()?.kind ?? null;
  const setError = (value: unknown) => setProblem(value === null ? null : failureFor(value));
  const [supported, setSupported] = createSignal(false);

  onMount(() => setSupported(canRecord()));

  let recorder: Recorder | null = null;

  const release = () => {
    recorder?.cancel();
    recorder = null;
  };

  // A recording still running when the page goes away is a microphone left
  // open, and the browser's indicator stays lit.
  onCleanup(release);

  const begin = async () => {
    setError(null);
    try {
      recorder = await startRecording();
      setState("recording");
    } catch (failure) {
      recorder = null;
      setState("idle");
      setError(failure);
    }
  };

  const finish = async () => {
    const current = recorder;
    recorder = null;
    if (!current) {
      setState("idle");
      return;
    }

    setState("transcribing");
    try {
      const { audio, mimeType } = await current.stop();
      const text = await transcribe(audio, mimeType);
      if (text === "") {
        setProblem({ message: "I could not hear anything in that.", kind: "silent" });
      } else {
        onTranscript(text);
      }
    } catch (failure) {
      setError(failure);
    } finally {
      setState("idle");
    }
  };

  return {
    supported,
    state,
    error,
    errorKind,
    toggle: () => {
      if (state() === "transcribing") return;
      void (state() === "recording" ? finish() : begin());
    },
    cancel: () => {
      release();
      setState("idle");
      setError(null);
    },
  };
}

function failureFor(failure: unknown): { message: string; kind: DictationErrorKind } {
  if (failure instanceof TranscribeError) {
    return {
      message: failure.message,
      kind: failure.reason === "unavailable" ? "unavailable" : "failed",
    };
  }
  if (failure instanceof RecorderError) {
    const kind =
      failure.reason === "denied"
        ? "denied"
        : failure.reason === "unavailable"
          ? "no-microphone"
          : "failed";
    return { message: failure.message, kind };
  }
  return { message: "That recording could not be used.", kind: "failed" };
}
