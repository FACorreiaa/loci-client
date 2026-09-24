import { describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({ transcribe: vi.fn() }));

vi.mock("../connect-transport", () => ({ transport: {} }));
vi.mock("@connectrpc/connect", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@connectrpc/connect")>()),
  createClient: () => rpc,
}));

import { Code, ConnectError } from "@connectrpc/connect";
import { transcribe, TranscribeError } from "./speech";

const failWith = async (error: ConnectError) => {
  rpc.transcribe.mockRejectedValueOnce(error);
  try {
    await transcribe(new Uint8Array([1]), "audio/webm");
  } catch (caught) {
    return caught as TranscribeError;
  }
  throw new Error("expected transcribe to reject");
};

describe("transcribe failures", () => {
  it("reads FailedPrecondition as speech not configured on this server", async () => {
    const failure = await failWith(
      new ConnectError("speech is not configured", Code.FailedPrecondition),
    );
    expect(failure).toBeInstanceOf(TranscribeError);
    expect(failure.reason).toBe("not-configured");
  });

  it("reads Unavailable as a passing failure, in the server's own words", async () => {
    const failure = await failWith(new ConnectError("whisper is behind", Code.Unavailable));
    expect(failure.reason).toBe("unavailable");
    expect(failure.message).toBe("whisper is behind");
  });
});
