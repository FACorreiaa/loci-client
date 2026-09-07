/**
 * @vitest-environment happy-dom
 *
 * This module dispatches and listens on `window`, so it cannot be tested in the
 * default node environment — every assertion would pass vacuously, because
 * `notifyAuthEstablished` returns early without a window and
 * `onAuthEstablished` hands back a no-op. That is precisely the failure mode
 * these tests exist to catch, so they need a real DOM.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  notifyAuthEstablished,
  notifyAuthExpired,
  onAuthEstablished,
  onAuthExpired,
} from "./auth-events";
import { clearAuthToken, setAuthToken } from "./tokens";

afterEach(() => {
  clearAuthToken();
  vi.restoreAllMocks();
});

// The bug this channel exists for.
//
// isAuthenticated() is derived from AuthContext's in-memory `user` signal, and
// only three things ever set it: onMount (page load), establishSession (called
// by login and MFA), and the `storage` event — which by specification never
// fires in the tab that wrote the value.
//
// The OAuth mutations write tokens with setAuthToken and stop there. So after
// signing up with Google, tokens existed, `user` was still null, and the route
// gate rendered the landing page. Only a manual refresh recovered it, because a
// refresh is the one path that reads the token and populates `user`.
describe("auth-established", () => {
  it("fires when a token is stored, which is the moment a session begins", async () => {
    const handler = vi.fn();
    const off = onAuthEstablished(handler);

    setAuthToken("token-abc", true, "refresh-abc");
    // Asynchronous on purpose — see the delivery test below.
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));

    off();
  });

  // establishSession calls setAuthToken and then sets `user` synchronously. A
  // synchronous event would run between those two statements, find no user, and
  // fetch the profile a second time for a session that was already established.
  // Deferring by a microtask lets the caller finish first, so the listener's
  // "only if there is no user" guard can do its job.
  it("is delivered after the caller's own synchronous work", () => {
    const order: string[] = [];
    const off = onAuthEstablished(() => order.push("listener"));

    setAuthToken("token-abc", true);
    order.push("caller finished");

    off();
    expect(order[0]).toBe("caller finished");
  });

  it("does not fire when tokens are cleared", async () => {
    setAuthToken("token-abc", true);
    await new Promise((r) => setTimeout(r, 0));

    const handler = vi.fn();
    const off = onAuthEstablished(handler);
    clearAuthToken();
    await new Promise((r) => setTimeout(r, 0));

    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("stops calling a handler once unsubscribed", async () => {
    const handler = vi.fn();
    onAuthEstablished(handler)();

    setAuthToken("token-abc", true);
    await new Promise((r) => setTimeout(r, 0));

    expect(handler).not.toHaveBeenCalled();
  });

  it("is a separate channel from expiry", async () => {
    const established = vi.fn();
    const expired = vi.fn();
    const offA = onAuthEstablished(established);
    const offB = onAuthExpired(expired);

    notifyAuthEstablished();
    await vi.waitFor(() => expect(established).toHaveBeenCalled());
    expect(expired).not.toHaveBeenCalled();

    notifyAuthExpired();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(established).toHaveBeenCalledTimes(1);

    offA();
    offB();
  });

  // Both signals are called from modules that also run during SSR.
  it("is inert without a window", () => {
    const window = globalThis.window;
    // @ts-expect-error deliberately removing the global to simulate SSR
    delete globalThis.window;
    try {
      expect(() => notifyAuthEstablished()).not.toThrow();
      expect(onAuthEstablished(() => {})).toBeInstanceOf(Function);
    } finally {
      globalThis.window = window;
    }
  });
});
