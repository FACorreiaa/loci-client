/**
 * Recording from the microphone.
 *
 * Deliberately small: start, stop, and a way to know whether the browser can
 * do it at all. Everything about formats lives in ./wav, and everything about
 * what the words mean lives on the server.
 */

import { SAMPLE_RATE, toWav } from "./wav";

/** How long a recording may run before it stops itself. */
export const MAX_RECORDING_MS = 60_000;

/** Whether this browser can record at all. */
export function canRecord(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined" &&
    typeof AudioContext !== "undefined" &&
    typeof OfflineAudioContext !== "undefined"
  );
}

/**
 * Why a recording could not be made.
 *
 * Told apart because the advice differs: a refused permission is fixed in the
 * browser's settings, and a missing microphone is not fixable at all.
 */
export type RecorderFailure = "denied" | "unavailable" | "failed";

export class RecorderError extends Error {
  readonly reason: RecorderFailure;

  constructor(reason: RecorderFailure, message: string) {
    super(message);
    this.name = "RecorderError";
    this.reason = reason;
  }
}

export interface Recording {
  /** 16 kHz mono WAV. */
  audio: Uint8Array;
  mimeType: "audio/wav";
}

export interface Recorder {
  /** Resolves with the recording, or rejects if it could not be made. */
  stop(): Promise<Recording>;
  /** Abandons the recording and releases the microphone. */
  cancel(): void;
}

/**
 * Starts recording, asking for the microphone if it has not been granted.
 *
 * The prompt happens here rather than on page load, which is the same rule the
 * location prompt follows: a permission asked for out of nowhere gets refused,
 * and a refusal is much harder to undo than a question not yet asked.
 */
export async function startRecording(): Promise<Recorder> {
  if (!canRecord()) {
    throw new RecorderError("unavailable", "This browser cannot record audio.");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch (error) {
    throw asRecorderError(error);
  }

  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream);
  } catch (error) {
    releaseAll(stream);
    throw asRecorderError(error);
  }

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start();

  // A recording that runs on forever is a microphone left open by accident,
  // and an upload nobody meant to make.
  const selfStop = setTimeout(() => {
    if (recorder.state === "recording") recorder.stop();
  }, MAX_RECORDING_MS);

  const finish = (): Promise<Recording> =>
    new Promise((resolve, reject) => {
      recorder.onstop = () => {
        clearTimeout(selfStop);
        releaseAll(stream);
        void (async () => {
          try {
            const audio = await toWav(new Blob(chunks, { type: recorder.mimeType }));
            resolve({ audio, mimeType: "audio/wav" });
          } catch (error) {
            reject(asRecorderError(error));
          }
        })();
      };
      recorder.onerror = () => {
        clearTimeout(selfStop);
        releaseAll(stream);
        reject(new RecorderError("failed", "The recording stopped unexpectedly."));
      };
    });

  return {
    stop() {
      const done = finish();
      if (recorder.state === "recording") recorder.stop();
      return done;
    },
    cancel() {
      clearTimeout(selfStop);
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state === "recording") recorder.stop();
      releaseAll(stream);
    },
  };
}

/**
 * Every track is stopped, not just the stream dropped.
 *
 * A track left running keeps the browser's recording indicator lit, which
 * looks to the person like the page is still listening — and as far as the
 * microphone is concerned, it is.
 */
function releaseAll(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

function asRecorderError(error: unknown): RecorderError {
  if (error instanceof RecorderError) return error;

  const name = error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return new RecorderError("denied", "Loci needs permission to use your microphone.");
    case "NotFoundError":
    case "OverconstrainedError":
      return new RecorderError("unavailable", "No microphone was found.");
    default:
      return new RecorderError("failed", "The recording could not be made.");
  }
}
