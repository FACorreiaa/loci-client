import { describe, expect, it, vi } from "vitest";
import { Code, ConnectError } from "@connectrpc/connect";
import { type AuthAction, describeAuthError, neverReachedServer } from "./auth-errors";

const ACTIONS: AuthAction[] = [
  "sign-in",
  "sign-up",
  "mfa",
  "reset-request",
  "reset-password",
  "google",
  "apple",
];

const EVERY_CODE = Object.values(Code).filter((c): c is Code => typeof c === "number");

// The bug this module was written for. A server message reached the page
// verbatim, brackets and all.
describe("no server string ever reaches the page", () => {
  const leaky = "OAuth provider not configured: missing GOOGLE_CLIENT_SECRET";

  it.each(ACTIONS)("keeps the raw message out of the %s form", (action) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const code of EVERY_CODE) {
      const { message } = describeAuthError(new ConnectError(leaky, code), action);
      expect(message).not.toContain(leaky);
      expect(message).not.toContain("GOOGLE_CLIENT_SECRET");
      expect(message).not.toContain("[");
      expect(message).not.toMatch(/failed_precondition|unauthenticated|resource_exhausted/i);
    }
    vi.restoreAllMocks();
  });

  it("maps every Code to a sentence, or to silence on purpose", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const code of EVERY_CODE) {
      const { message } = describeAuthError(new ConnectError("x", code), "sign-in");
      // Canceled is the one deliberate empty string: the user navigated away.
      if (code === Code.Canceled) {
        expect(message).toBe("");
      } else {
        expect(message.length).toBeGreaterThan(10);
        expect(message.trimEnd()).toMatch(/[.!]$/);
      }
    }
    vi.restoreAllMocks();
  });
});

// The second half of the bug: one `hasAuthError` flag reddened both the email
// and the password box for an error about neither.
describe("only a field's own fault marks that field", () => {
  it("marks nothing when the OAuth provider is unconfigured", () => {
    expect(describeAuthError(new ConnectError("x", Code.FailedPrecondition), "google").field).toBe(
      null,
    );
  });

  it("marks nothing for wrong credentials, which could be either box", () => {
    expect(describeAuthError(new ConnectError("x", Code.Unauthenticated), "sign-in").field).toBe(
      null,
    );
  });

  it("marks the email box when that email is already taken", () => {
    expect(describeAuthError(new ConnectError("x", Code.AlreadyExists), "sign-up").field).toBe(
      "email",
    );
  });

  it("marks the code box on a rejected second factor", () => {
    expect(describeAuthError(new ConnectError("x", Code.Unauthenticated), "mfa").field).toBe(
      "code",
    );
  });

  it("marks nothing when the API is unreachable", () => {
    expect(describeAuthError(new ConnectError("x", Code.Unavailable), "sign-in").field).toBe(null);
  });
});

describe("account enumeration", () => {
  // A different sentence for "no such account" than for "wrong password" lets
  // anyone test whether an address has a Loci account.
  it("answers identically whether the account is missing or the password wrong", () => {
    const missing = describeAuthError(new ConnectError("user not found", Code.NotFound), "sign-in");
    const wrong = describeAuthError(
      new ConnectError("invalid credentials", Code.Unauthenticated),
      "sign-in",
    );
    expect(missing).toEqual(wrong);
  });
});

describe("naming the provider that failed", () => {
  it.each([
    ["google", "Google"],
    ["apple", "Apple"],
  ] as const)("says %s by name", (action, label) => {
    const { message } = describeAuthError(
      new ConnectError("x", Code.FailedPrecondition),
      action as AuthAction,
    );
    expect(message).toContain(label);
  });
});

describe("a request that never reached the server", () => {
  // Connect wraps a rejected fetch with Code.Unknown and the TypeError as cause,
  // so the check is on the cause's type — not on "Failed to fetch", which is the
  // browser's wording and varies by engine.
  it.each([
    ["a bare TypeError", new TypeError("Failed to fetch")],
    [
      "a ConnectError wrapping one",
      new ConnectError(
        "Load failed",
        Code.Unknown,
        undefined,
        undefined,
        new TypeError("Load failed"),
      ),
    ],
  ])("reads %s as a connection problem", (_label, error) => {
    const { message, field } = describeAuthError(error, "sign-in");
    expect(message).toMatch(/connection/i);
    expect(field).toBe(null);
  });
});

describe("something that is not an RPC failure at all", () => {
  it("shows the generic line and logs the detail for a developer", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { message } = describeAuthError(
      new Error("cannot read property of undefined"),
      "sign-up",
    );
    expect(message).not.toContain("undefined");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// The forgot-password form claims success whatever the server answers, so that
// it cannot be used to test which addresses have accounts. That is only right
// when the server actually answered.
describe("neverReachedServer", () => {
  it.each([
    ["a rejected fetch", new TypeError("Failed to fetch")],
    ["an unreachable API", new ConnectError("no upstream", Code.Unavailable)],
    ["a timeout", new ConnectError("too slow", Code.DeadlineExceeded)],
    ["an abort", new ConnectError("aborted", Code.Canceled)],
  ])("is true for %s", (_label, error) => {
    expect(neverReachedServer(error)).toBe(true);
  });

  it.each([
    ["no such account", new ConnectError("user not found", Code.NotFound)],
    ["a rejected password", new ConnectError("invalid credentials", Code.Unauthenticated)],
    ["a server-side crash", new ConnectError("boom", Code.Internal)],
    ["throttling", new ConnectError("slow down", Code.ResourceExhausted)],
  ])("is false for %s, which the server answered", (_label, error) => {
    expect(neverReachedServer(error)).toBe(false);
  });

  it("is false for something that is not an RPC failure", () => {
    expect(neverReachedServer(new Error("nope"))).toBe(false);
    expect(neverReachedServer(undefined)).toBe(false);
  });
});
