import { describe, expect, it } from "vitest";
import { describeUserAgent } from "./user-agent";

describe("describeUserAgent", () => {
  // The string that prompted this: two sessions rendered identically.
  it("names the browser and platform", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
      ),
    ).toBe("Chrome on macOS");
  });

  // Every Chromium browser also claims Chrome, and all of them claim Safari,
  // so the specific ones have to win.
  it("prefers the specific browser over the engine it claims", () => {
    const cases: [string, string][] = [
      [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
        "Edge on Windows",
      ],
      [
        "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0",
        "Opera on Windows",
      ],
      [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Safari on macOS",
      ],
    ];
    for (const [ua, want] of cases) {
      expect(describeUserAgent(ua)).toBe(want);
    }
  });

  // iPadOS claims to be a Mac.
  it("tells an iPad from a Mac", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iPad");
  });

  it("handles mobile browsers that rename themselves", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Chrome on iPhone");
    expect(
      describeUserAgent("Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0"),
    ).toBe("Firefox on Android");
  });

  // On a security screen an invented answer is worse than an honest blank.
  it("does not guess when there is nothing to go on", () => {
    expect(describeUserAgent("")).toBe("Unrecognised device");
    expect(describeUserAgent(undefined)).toBe("Unrecognised device");
    expect(describeUserAgent(null)).toBe("Unrecognised device");
    expect(describeUserAgent("   ")).toBe("Unrecognised device");
  });

  it("falls back to the real string when it recognises nothing", () => {
    expect(describeUserAgent("curl/8.4.0")).toBe("curl/8.4.0");
    expect(describeUserAgent("x".repeat(60))).toBe(`${"x".repeat(40)}…`);
  });
});
