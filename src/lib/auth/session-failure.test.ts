import { describe, it, expect } from "vitest";
import { ConnectError, Code } from "@connectrpc/connect";
import { isDeadSession } from "./session-failure";

describe("isDeadSession", () => {
  it("treats an Unauthenticated response as a dead session", () => {
    expect(isDeadSession(new ConnectError("token rejected", Code.Unauthenticated))).toBe(true);
  });

  // The regression this file exists for: session restore used to clear the
  // user's tokens on ANY failure, so a briefly unreachable API signed people
  // out on every page refresh even though their session was fine.
  it.each([
    ["server error", new ConnectError("boom", Code.Internal)],
    ["unavailable", new ConnectError("no upstream", Code.Unavailable)],
    ["deadline", new ConnectError("too slow", Code.DeadlineExceeded)],
    ["plain network failure", new TypeError("Failed to fetch")],
    ["non-error value", "something went wrong"],
    ["nothing at all", undefined],
  ])("keeps the session on a %s", (_label, error) => {
    expect(isDeadSession(error)).toBe(false);
  });
});
