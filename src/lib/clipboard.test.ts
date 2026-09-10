// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

function setSecureContext(on: boolean) {
  Object.defineProperty(window, "isSecureContext", { value: on, configurable: true });
}

function setClipboard(writeText: ((t: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

// happy-dom does not implement execCommand at all, so it is installed rather
// than spied on. Returns the mock for assertions.
function setExecCommand(impl: (cmd: string) => boolean) {
  const fn = vi.fn(impl);
  Object.defineProperty(document, "execCommand", { value: fn, configurable: true });
  return fn;
}

describe("copyText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setClipboard(undefined);
    setSecureContext(true);
    Reflect.deleteProperty(document, "execCommand");
  });

  it("uses the async clipboard API in a secure context", async () => {
    const writeText = vi.fn(async () => {});
    setSecureContext(true);
    setClipboard(writeText);
    const exec = setExecCommand(() => true);

    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(exec).not.toHaveBeenCalled();
  });

  it("falls back to execCommand outside a secure context", async () => {
    const writeText = vi.fn(async () => {});
    setSecureContext(false);
    setClipboard(writeText);
    const exec = setExecCommand((cmd: string) => {
      expect(cmd).toBe("copy");
      // The text must be selected and in the document at the moment of the copy.
      const area = document.activeElement as HTMLTextAreaElement | null;
      expect(area?.tagName).toBe("TEXTAREA");
      expect(area?.value).toBe("plain http");
      return true;
    });

    await expect(copyText("plain http")).resolves.toBe(true);
    expect(writeText).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledTimes(1);
    // The scratch textarea is gone afterwards.
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back to execCommand when writeText rejects", async () => {
    setSecureContext(true);
    setClipboard(vi.fn(async () => Promise.reject(new DOMException("denied"))));
    setExecCommand(() => true);

    await expect(copyText("x")).resolves.toBe(true);
  });

  it("returns false, never throws, when nothing works", async () => {
    setSecureContext(false);
    setClipboard(undefined);
    setExecCommand(() => {
      throw new Error("not supported");
    });

    await expect(copyText("x")).resolves.toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });
});
