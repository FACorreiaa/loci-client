/** Loudness above this counts as speech. Quiet enough for a normal voice at arm's length. */
const SPEECH_LEVEL = 0.02;
/** How long a pause means they have finished. */
export const SILENCE_AFTER_MS = 1200;

/**
 * Decides when somebody has stopped talking.
 *
 * Only after they have started: a pause before the first word is someone
 * thinking of what to ask, and stopping then would send nothing. In a loud place
 * this may never fire, which is why the stop button and the recording cap stay.
 */
export function createSilenceDetector(afterMs = SILENCE_AFTER_MS, level = SPEECH_LEVEL) {
  let heardAt: number | null = null;
  return {
    /** Takes a loudness and the time it was measured; true means stop. */
    feed(loudness: number, now: number): boolean {
      if (loudness >= level) {
        heardAt = now;
        return false;
      }
      return heardAt !== null && now - heardAt >= afterMs;
    },
  };
}

/** The loudness (root mean square) of samples centred on 128, as an AnalyserNode gives them. */
export function rms(samples: Uint8Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) {
    const v = (s - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}
