/**
 * Vitest setup for happy-dom environments.
 *
 * Node 22+ defines `globalThis.localStorage` as a getter that returns
 * `undefined` unless `--localstorage-file` is passed. Vitest's happy-dom
 * integration copies properties from the happy-dom Window onto
 * `globalThis`, but the `localStorage` getter is context-dependent —
 * it needs `this` to be the original happy-dom Window instance. When
 * copied to `globalThis` (which is `window` in vitest), the getter
 * loses its context and returns `undefined`.
 *
 * This setup creates a fresh happy-dom Window and pins its localStorage
 * as a concrete value on `globalThis`, bypassing the broken getter.
 */
if (typeof window !== "undefined" && typeof window.localStorage === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Window } = require("happy-dom");
    const hdWindow = new Window({ url: "http://localhost" });
    Object.defineProperty(globalThis, "localStorage", {
      value: hdWindow.localStorage,
      writable: true,
      configurable: true,
    });
  } catch {
    // happy-dom not available; nothing to do
  }
}
