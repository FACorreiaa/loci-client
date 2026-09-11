// Turning a recording into words.
import { createClient } from "@connectrpc/connect";
import { Code, ConnectError } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  SpeechService,
  TranscribeRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/speech/speech_pb.js";
import { transport } from "../connect-transport";

const client = createClient(SpeechService, transport);

/**
 * Why a recording could not be turned into words.
 *
 * "unavailable" is the server having no speech configured, which is a
 * deployment state rather than a fault, and the difference decides whether the
 * microphone should be offered at all.
 */
export type TranscribeFailure = "unavailable" | "rejected" | "busy" | "failed";

export class TranscribeError extends Error {
  readonly reason: TranscribeFailure;

  constructor(reason: TranscribeFailure, message: string) {
    super(message);
    this.name = "TranscribeError";
    this.reason = reason;
  }
}

/**
 * Returns what was said in a recording.
 *
 * An empty string means there was no speech in it — a pocket, or a minute of
 * traffic — which is an answer rather than a failure, and worth telling apart
 * so the reply can say so.
 */
export async function transcribe(audio: Uint8Array, mimeType: string): Promise<string> {
  try {
    const response = await client.transcribe(create(TranscribeRequestSchema, { audio, mimeType }));
    return response.text.trim();
  } catch (error) {
    throw asTranscribeError(error);
  }
}

function asTranscribeError(error: unknown): TranscribeError {
  if (!(error instanceof ConnectError)) {
    return new TranscribeError("failed", "That recording could not be understood.");
  }
  switch (error.code) {
    case Code.FailedPrecondition:
      return new TranscribeError("unavailable", "Dictation is not available on this server.");
    case Code.Unavailable:
      // The server says which of these it was; its own wording is better than
      // anything guessed here, because it knows whether the service is down or
      // merely behind.
      return new TranscribeError(
        "unavailable",
        error.rawMessage || "Dictation is unavailable right now.",
      );
    case Code.InvalidArgument:
      return new TranscribeError("rejected", "That recording was not in a format Loci can read.");
    case Code.ResourceExhausted:
      return new TranscribeError("busy", "Loci is behind on voice notes. Try again in a moment.");
    default:
      return new TranscribeError("failed", "That recording could not be understood.");
  }
}
