import { describe, expect, it } from "vitest";
import {
  agentFromParam,
  anyWaitingForFirstUse,
  FIRST_USE_WINDOW_MS,
  firstUseState,
  minutesUntil,
  telegramState,
} from "./state";

describe("agentFromParam", () => {
  it("defaults to Claude Code when the param is absent or empty", () => {
    expect(agentFromParam(undefined)).toBe("claude_code");
    expect(agentFromParam(null)).toBe("claude_code");
    expect(agentFromParam("")).toBe("claude_code");
  });

  it("returns a known kind as itself", () => {
    expect(agentFromParam("codex")).toBe("codex");
    expect(agentFromParam("claude_desktop")).toBe("claude_desktop");
    expect(agentFromParam("cursor")).toBe("cursor");
    expect(agentFromParam("hermes")).toBe("hermes");
    expect(agentFromParam("other")).toBe("other");
  });

  it("sends an unknown kind to the generic setup, not the default", () => {
    expect(agentFromParam("gemini")).toBe("other");
    expect(agentFromParam("CODEX")).toBe("other");
    expect(agentFromParam("../etc")).toBe("other");
  });

  it("takes the first value of a repeated param", () => {
    expect(agentFromParam(["hermes", "codex"])).toBe("hermes");
    expect(agentFromParam([])).toBe("claude_code");
  });
});

describe("firstUseState", () => {
  const now = 1_700_000_000_000;

  it("is connected once the key has been used, however old it is", () => {
    expect(firstUseState({ createdAt: now - 1_000, lastUsedAt: now - 500 }, now)).toBe("connected");
    expect(firstUseState({ createdAt: now - 30 * 86_400_000, lastUsedAt: now - 1 }, now)).toBe(
      "connected",
    );
  });

  it("waits for a first use during the ten minutes after creation", () => {
    expect(firstUseState({ createdAt: now }, now)).toBe("waiting");
    expect(firstUseState({ createdAt: now - FIRST_USE_WINDOW_MS + 1 }, now)).toBe("waiting");
  });

  it("stops waiting at ten minutes exactly", () => {
    expect(firstUseState({ createdAt: now - FIRST_USE_WINDOW_MS }, now)).toBe("not_used");
    expect(firstUseState({ createdAt: now - 2 * FIRST_USE_WINDOW_MS }, now)).toBe("not_used");
  });

  it("never waits on a key with no creation time", () => {
    expect(firstUseState({}, now)).toBe("not_used");
  });
});

describe("anyWaitingForFirstUse", () => {
  const now = 1_700_000_000_000;

  it("is false for no keys", () => {
    expect(anyWaitingForFirstUse(undefined, now)).toBe(false);
    expect(anyWaitingForFirstUse([], now)).toBe(false);
  });

  it("is true while any live key is waiting", () => {
    expect(
      anyWaitingForFirstUse(
        [{ createdAt: now - 86_400_000, lastUsedAt: now - 1 }, { createdAt: now - 1_000 }],
        now,
      ),
    ).toBe(true);
  });

  it("ignores revoked keys, so a fresh key revoked at once does not poll", () => {
    expect(anyWaitingForFirstUse([{ createdAt: now - 1_000, revokedAt: now }], now)).toBe(false);
  });
});

describe("telegramState", () => {
  const now = 1_700_000_000_000;
  const link = { platform: "telegram", displayName: "@me", linkedAt: now - 1 };
  const code = { code: "ABC123", expiresAt: now + 5 * 60_000 };

  it("is disabled when the server has no bot, whatever else is true", () => {
    expect(telegramState(null, null, false, now)).toBe("disabled");
    expect(telegramState(link, code, false, now)).toBe("disabled");
  });

  it("is linked as soon as a link exists, even with a code outstanding", () => {
    expect(telegramState(link, null, true, now)).toBe("linked");
    expect(telegramState(link, code, true, now)).toBe("linked");
  });

  it("shows an outstanding code until it expires", () => {
    expect(telegramState(null, code, true, now)).toBe("code");
    expect(telegramState(null, code, true, code.expiresAt)).toBe("idle");
    expect(telegramState(null, { code: "X" }, true, now)).toBe("code");
  });

  it("is idle with nothing linked and no code", () => {
    expect(telegramState(null, null, true, now)).toBe("idle");
    expect(telegramState(undefined, undefined, true, now)).toBe("idle");
    expect(telegramState(null, { code: "", expiresAt: now + 1 }, true, now)).toBe("idle");
  });
});

describe("minutesUntil", () => {
  it("rounds up and never goes negative", () => {
    const now = 1_700_000_000_000;
    expect(minutesUntil(now + 61_000, now)).toBe(2);
    expect(minutesUntil(now + 60_000, now)).toBe(1);
    expect(minutesUntil(now - 1, now)).toBe(0);
    expect(minutesUntil(undefined, now)).toBe(0);
  });
});
