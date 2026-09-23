import { describe, it, expect } from "vitest";
import { parseStreamError, startErrorMessage } from "./errors";

describe("parseStreamError", () => {
  // The server rejects over-quota users with a resource_exhausted Connect error.
  // That used to fall into the generic rate-limit branch and tell people the AI
  // was "busy, try again in 60 seconds" - advice that can never work, because
  // the daily counter only resets at midnight UTC.
  it("treats a daily plan quota as exhausted, not as a transient rate limit", () => {
    const parsed = parseStreamError(
      "resource_exhausted: daily request quota exceeded (plan free, limit 10)",
    );

    expect(parsed.type).toBe("quota_exhausted");
    expect(parsed.canRetry).toBe(false);
    expect(parsed.userMessage).toMatch(/midnight UTC/i);
    expect(parsed.userMessage).toMatch(/Pro/);
  });

  it("keeps the fair-use wording for paid plans", () => {
    const parsed = parseStreamError("daily fair-use quota exhausted; it resets at midnight UTC");

    expect(parsed.type).toBe("quota_exhausted");
    expect(parsed.userMessage).not.toMatch(/upgrade to Pro/i);
  });

  it("still reports upstream provider throttling as a retryable rate limit", () => {
    const parsed = parseStreamError("429 rate limit exceeded, retry in 30s");

    expect(parsed.type).toBe("rate_limit");
    expect(parsed.canRetry).toBe(true);
    expect(parsed.retryAfter).toBe(30);
  });
});

describe("parseStreamError — concurrent search cap", () => {
  const cap = "You have 3 searches running — wait for one to finish";

  it("passes the server's cap message through, not as a rate limit", () => {
    const parsed = parseStreamError(cap);
    expect(parsed.type).toBe("run_cap");
    expect(parsed.userMessage).toBe(cap);
    expect(parsed.canRetry).toBe(false);
  });

  it("still words a real rate limit as one", () => {
    expect(parseStreamError("resource_exhausted: rate limit").type).toBe("rate_limit");
  });
});

describe("startErrorMessage", () => {
  it("shows the cap verbatim and anything else as the fallback", () => {
    const cap = "You have 3 searches running — wait for one to finish";
    expect(startErrorMessage(cap, "fallback")).toBe(cap);
    expect(startErrorMessage("Stream error: boom", "fallback")).toBe("fallback");
  });
});
