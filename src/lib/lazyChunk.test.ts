// @vitest-environment happy-dom
//
// lazyChunk reads sessionStorage and calls location.reload, neither of which
// exists in the default node environment.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadFailure, lazyChunk, RELOAD_KEY } from "./lazyChunk";

// The message Chrome produced for the deploy that prompted this: the asset
// host answered a missing chunk with the SPA fallback rather than a 404.
const MIME_ERROR = new TypeError(
  "Failed to load module script: Expected a JavaScript-or-Wasm module script " +
    'but the server responded with a MIME type of "text/html". Strict MIME type ' +
    "checking is enforced for module scripts per HTML spec.",
);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("isChunkLoadFailure", () => {
  it.each([
    [MIME_ERROR],
    [new TypeError("Failed to fetch dynamically imported module: https://lociai.fyi/a.js")],
    [new TypeError("error loading dynamically imported module")],
    [new TypeError("Importing a module script failed.")],
  ])("recognises %s", (error) => {
    expect(isChunkLoadFailure(error)).toBe(true);
  });

  // A component that throws while it initialises is a real bug. Reloading
  // would hide it behind a refresh loop's worth of blank pages.
  it.each([
    [new Error("mapboxgl: invalid access token")],
    [new TypeError("Cannot read properties of undefined (reading 'map')")],
    [undefined],
  ])("does not claim %s", (error) => {
    expect(isChunkLoadFailure(error)).toBe(false);
  });
});

describe("lazyChunk", () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  it("passes a chunk that loads straight through", async () => {
    const component = () => null;
    const wrapped = lazyChunk(async () => ({ default: component }));
    await expect(wrapped.preload()).resolves.toMatchObject({ default: component });
    expect(reload).not.toHaveBeenCalled();
  });

  // The stale tab. One reload is what fetches the document that names the
  // chunks this build actually has.
  it("reloads once when the chunk is gone", async () => {
    const wrapped = lazyChunk(() => Promise.reject(MIME_ERROR));
    void wrapped.preload();
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_KEY)).toBeTruthy();
  });

  // The reload did not fix it, so the chunk is genuinely missing. Reloading
  // again would spin forever; the error has to reach a boundary instead.
  it("does not reload twice for the same failure", async () => {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    const wrapped = lazyChunk(() => Promise.reject(MIME_ERROR));
    await expect(wrapped.preload()).rejects.toThrow(/MIME type/);
    expect(reload).not.toHaveBeenCalled();
  });

  // A tab left open across two deploys deserves two recoveries, so the guard
  // is a cooldown rather than a once-per-session flag.
  it("reloads again once the cooldown has passed", async () => {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now() - 60_000));
    const wrapped = lazyChunk(() => Promise.reject(MIME_ERROR));
    void wrapped.preload();
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("re-throws a failure a reload cannot explain", async () => {
    const boom = new Error("mapboxgl: invalid access token");
    const wrapped = lazyChunk(() => Promise.reject(boom));
    await expect(wrapped.preload()).rejects.toThrow("mapboxgl: invalid access token");
    expect(reload).not.toHaveBeenCalled();
  });
});
