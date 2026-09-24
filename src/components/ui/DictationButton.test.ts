// @vitest-environment happy-dom

import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TranscribeError extends Error {
    readonly reason: string;
    constructor(reason: string, message: string) {
      super(message);
      this.reason = reason;
    }
  }
  return {
    canRecord: vi.fn(() => false),
    startRecording: vi.fn(),
    transcribe: vi.fn(),
    TranscribeError,
  };
});

vi.mock("~/lib/audio/recorder", () => ({
  canRecord: mocks.canRecord,
  startRecording: mocks.startRecording,
  RecorderError: class RecorderError extends Error {},
}));

vi.mock("~/lib/api/speech", () => ({
  transcribe: mocks.transcribe,
  TranscribeError: mocks.TranscribeError,
}));

import DictationButton, {
  appendTranscript,
  dictationHintText,
  resetDictationAvailability,
  type DictationButtonProps,
} from "./DictationButton";

describe("appendTranscript", () => {
  it("fills an empty box with the transcript", () => {
    expect(appendTranscript("", "Lisbon for two days")).toBe("Lisbon for two days");
  });

  it("treats a whitespace-only box as empty, leaving no leading space", () => {
    expect(appendTranscript("   ", "Porto")).toBe("Porto");
  });

  it("appends with exactly one space", () => {
    expect(appendTranscript("Lisbon for two days", "with late dinners")).toBe(
      "Lisbon for two days with late dinners",
    );
  });

  it("does not double a space the box already ends with", () => {
    expect(appendTranscript("Lisbon ", "  walking ")).toBe("Lisbon walking");
  });

  it("leaves the box alone when nothing was said", () => {
    expect(appendTranscript("Lisbon ", "   ")).toBe("Lisbon ");
  });
});

describe("dictationHintText", () => {
  it("prefers the error to the state", () => {
    expect(dictationHintText({ state: "idle", error: "No microphone was found." })).toBe(
      "No microphone was found.",
    );
  });

  it("says nothing when idle", () => {
    expect(dictationHintText({ state: "idle", error: null })).toBe("");
  });
});

describe("DictationButton", () => {
  const disposers: Array<() => void> = [];

  const mount = (props: Partial<DictationButtonProps> = {}) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const onTranscript = vi.fn();
    disposers.push(
      render(() => createComponent(DictationButton, { onTranscript, ...props }), host),
    );
    return { host, onTranscript };
  };

  // onMount runs in a microtask after render; supported() flips then.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    resetDictationAvailability();
    mocks.canRecord.mockReset().mockReturnValue(false);
    mocks.startRecording.mockReset();
    mocks.transcribe.mockReset();
  });

  afterEach(() => {
    while (disposers.length) disposers.pop()?.();
    document.body.innerHTML = "";
  });

  it("renders nothing where the browser cannot record", async () => {
    const { host } = mount();
    await settle();
    expect(host.querySelector("button")).toBeNull();
  });

  it("renders a labelled microphone where the browser can record", async () => {
    mocks.canRecord.mockReturnValue(true);
    const { host } = mount({ label: "Dictate a trip" });
    await settle();
    expect(host.querySelector("button")?.getAttribute("aria-label")).toBe("Dictate a trip");
  });

  it("hands the transcript back rather than sending anything", async () => {
    mocks.canRecord.mockReturnValue(true);
    mocks.startRecording.mockResolvedValue({
      stop: () => Promise.resolve({ audio: new Uint8Array([1]), mimeType: "audio/webm" }),
      cancel: vi.fn(),
    });
    mocks.transcribe.mockResolvedValue("Cais do Sodré");
    const states: string[] = [];
    const { host, onTranscript } = mount({ onStatusChange: (s) => states.push(s.state) });
    await settle();

    host.querySelector("button")!.click();
    await settle();
    host.querySelector("button")!.click();
    await settle();

    expect(onTranscript).toHaveBeenCalledWith("Cais do Sodré");
    expect(states).toEqual(["recording", "transcribing", "idle"]);
  });

  it("stops offering dictation anywhere once the server says speech is not configured", async () => {
    mocks.canRecord.mockReturnValue(true);
    mocks.startRecording.mockResolvedValue({
      stop: () => Promise.resolve({ audio: new Uint8Array([1]), mimeType: "audio/webm" }),
      cancel: vi.fn(),
    });
    mocks.transcribe.mockRejectedValue(
      new mocks.TranscribeError("not-configured", "Dictation is not available on this server."),
    );
    const errors: Array<string | null> = [];
    const first = mount({ onStatusChange: (s) => errors.push(s.error) });
    const second = mount();
    await settle();

    first.host.querySelector("button")!.click();
    await settle();
    first.host.querySelector("button")!.click();
    await settle();

    expect(first.host.querySelector("button")).toBeNull();
    expect(second.host.querySelector("button")).toBeNull();
    expect(errors).toContain("Dictation is not available on this server.");

    // And for anything mounted later in the same session.
    const third = mount();
    await settle();
    expect(third.host.querySelector("button")).toBeNull();
  });

  it("keeps offering dictation, with the server's words, when speech is only down for now", async () => {
    mocks.canRecord.mockReturnValue(true);
    mocks.startRecording.mockResolvedValue({
      stop: () => Promise.resolve({ audio: new Uint8Array([1]), mimeType: "audio/webm" }),
      cancel: vi.fn(),
    });
    mocks.transcribe.mockRejectedValue(
      new mocks.TranscribeError("unavailable", "Transcription is behind. Try again shortly."),
    );
    const errors: Array<string | null> = [];
    const { host } = mount({ onStatusChange: (s) => errors.push(s.error) });
    await settle();

    host.querySelector("button")!.click();
    await settle();
    host.querySelector("button")!.click();
    await settle();

    expect(host.querySelector("button")).not.toBeNull();
    expect(errors).toContain("Transcription is behind. Try again shortly.");
  });

  it("keeps offering dictation after an ordinary failure", async () => {
    mocks.canRecord.mockReturnValue(true);
    mocks.startRecording.mockResolvedValue({
      stop: () => Promise.resolve({ audio: new Uint8Array([1]), mimeType: "audio/webm" }),
      cancel: vi.fn(),
    });
    mocks.transcribe.mockRejectedValue(new mocks.TranscribeError("busy", "Try again."));
    const { host } = mount();
    await settle();

    host.querySelector("button")!.click();
    await settle();
    host.querySelector("button")!.click();
    await settle();

    expect(host.querySelector("button")).not.toBeNull();
  });
});
