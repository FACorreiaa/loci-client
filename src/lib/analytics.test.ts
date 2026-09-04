import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetAnalyticsForTest,
  capture,
  identify,
  initAnalytics,
  resetIdentity,
} from "./analytics";

/** Minimal stand-in for the posthog-js surface this module uses. */
function fakeClient() {
  return {
    init: vi.fn(),
    capture: vi.fn(),
    captureException: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  };
}

describe("analytics", () => {
  beforeEach(() => {
    __resetAnalyticsForTest();
  });

  it("does nothing when no key is configured", () => {
    const client = fakeClient();
    initAnalytics({ key: "", host: "https://eu.i.posthog.com", client });

    capture("signup_completed", { method: "password" });
    identify("user-1");

    expect(client.init).not.toHaveBeenCalled();
    expect(client.capture).not.toHaveBeenCalled();
    expect(client.identify).not.toHaveBeenCalled();
  });

  it("captures events once a key is configured", () => {
    const client = fakeClient();
    initAnalytics({ key: "phc_test", host: "https://eu.i.posthog.com", client });

    capture("itinerary_finished", { city: "Porto", days: 2 });

    expect(client.init).toHaveBeenCalledOnce();
    expect(client.capture).toHaveBeenCalledWith("itinerary_finished", { city: "Porto", days: 2 });
  });

  it("initialises at most once", () => {
    const client = fakeClient();
    initAnalytics({ key: "phc_test", host: "https://eu.i.posthog.com", client });
    initAnalytics({ key: "phc_test", host: "https://eu.i.posthog.com", client });

    expect(client.init).toHaveBeenCalledOnce();
  });

  it("identifies and resets the current user", () => {
    const client = fakeClient();
    initAnalytics({ key: "phc_test", host: "https://eu.i.posthog.com", client });

    identify("user-7", { plan: "free" });
    resetIdentity();

    expect(client.identify).toHaveBeenCalledWith("user-7", { plan: "free" });
    expect(client.reset).toHaveBeenCalledOnce();
  });

  // Analytics must never be the reason a user action fails.
  it("swallows client errors", () => {
    const client = fakeClient();
    client.capture.mockImplementation(() => {
      throw new Error("network down");
    });
    initAnalytics({ key: "phc_test", host: "https://eu.i.posthog.com", client });

    expect(() => capture("poi_saved", { poiId: "abc" })).not.toThrow();
  });

  // Events fired during server rendering, or before init, are dropped rather
  // than queued: a funnel event without a browser session is meaningless.
  it("drops events fired before initialisation", () => {
    const client = fakeClient();
    capture("upgrade_clicked", { interval: "monthly" });
    initAnalytics({ key: "phc_test", host: "https://eu.i.posthog.com", client });

    expect(client.capture).not.toHaveBeenCalled();
  });
});
