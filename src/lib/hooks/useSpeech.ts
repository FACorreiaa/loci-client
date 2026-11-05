import { onCleanup } from "solid-js";
import type { Speaker } from "~/lib/assistant/session";

export interface Speech extends Speaker {
  /**
   * Safari only speaks after a gesture has spoken once. Call this from the tap
   * that starts things; the answer arrives long after that tap is over.
   */
  unlock(): void;
}

/**
 * Reading answers aloud with the voice the device already has.
 *
 * Sentences queue, so the first is heard while the rest are still arriving.
 * Nothing keeps talking after the overlay closes or the page goes away.
 */
export function useSpeech(): Speech {
  const synth = (): SpeechSynthesis | null =>
    typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

  const stop = () => synth()?.cancel();

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", stop);
    onCleanup(() => window.removeEventListener("pagehide", stop));
  }
  onCleanup(stop);

  return {
    say(text) {
      const s = synth();
      if (!s || !text) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = navigator.language;
      s.speak(utterance);
    },
    stop,
    unlock() {
      const s = synth();
      if (!s) return;
      const silent = new SpeechSynthesisUtterance("");
      silent.volume = 0;
      s.speak(silent);
    },
  };
}
