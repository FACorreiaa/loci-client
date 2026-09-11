import { createSignal, onCleanup, onMount } from "solid-js";
import { canRecord, RecorderError, startRecording, type Recorder } from "~/lib/audio/recorder";
import { transcribe, TranscribeError } from "~/lib/api/speech";

export type DictationState = "idle" | "recording" | "transcribing";

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
  const [error, setError] = createSignal<string | null>(null);
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
      setError(messageFor(failure));
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
        setError("I could not hear anything in that.");
      } else {
        onTranscript(text);
      }
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setState("idle");
    }
  };

  return {
    supported,
    state,
    error,
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

function messageFor(failure: unknown): string {
  if (failure instanceof RecorderError || failure instanceof TranscribeError) {
    return failure.message;
  }
  return "That recording could not be used.";
}
