import { describe, expect, it } from "vitest";
import { createRoot } from "solid-js";
import { heroPrompt, requestHeroPrompt } from "./hero-prompt";

describe("requestHeroPrompt", () => {
  it("starts empty with a zero nonce so the hero ignores the initial value", () => {
    expect(heroPrompt()).toEqual({ text: "", nonce: 0 });
  });

  it("bumps the nonce on every request, even for the same text", () => {
    createRoot((dispose) => {
      requestHeroPrompt("Plan 3 days in Porto");
      const first = heroPrompt();
      requestHeroPrompt("Plan 3 days in Porto");
      const second = heroPrompt();
      expect(first.text).toBe("Plan 3 days in Porto");
      expect(second.nonce).toBe(first.nonce + 1);
      dispose();
    });
  });
});
