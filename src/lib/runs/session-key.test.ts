import { describe, expect, it } from "vitest";
import { routeKey, stepSessionKey, type SessionKeyState } from "./session-key";

// Walks a sequence of URL states through the rule, adopting where a page's
// own search is named, and returns the key after each step.
function walk(
  steps: Array<{ sessionId?: string; message?: string; cityName?: string; adopt?: string }>,
) {
  let state: SessionKeyState | undefined;
  return steps.map(({ adopt, ...params }) => {
    if (adopt && state) state = { ...state, adopted: adopt };
    state = stepSessionKey(state, params);
    return state.key;
  });
}

describe("result page session key", () => {
  it("keys on the session, or on the query before there is one", () => {
    expect(routeKey({ sessionId: "a" })).toBe("s:a");
    expect(routeKey({ message: "cheap", cityName: "Lisbon" })).toBe("q:cheap|Lisbon");
    expect(routeKey({})).toBe("q:|");
  });

  it("remounts when Open moves the same route to another session", () => {
    const [a, b] = walk([{ sessionId: "a" }, { sessionId: "b" }]);
    expect(a).not.toBe(b);
  });

  it("does not remount when the page writes its own new run's id into the URL", () => {
    const keys = walk([
      { message: "cheap", cityName: "Lisbon" },
      // useChatRPC's onStart: adopt, then setSearchParams({ sessionId }).
      { message: "cheap", cityName: "Lisbon", sessionId: "own", adopt: "own" },
    ]);
    expect(keys[1]).toBe(keys[0]);
  });

  it("does not remount when a re-search on the page replaces its own id", () => {
    const keys = walk([{ sessionId: "old" }, { sessionId: "new", adopt: "new" }]);
    expect(keys[1]).toBe(keys[0]);
  });

  it("still remounts for a session id the page did not start", () => {
    const keys = walk([
      { message: "cheap", cityName: "Lisbon" },
      { message: "cheap", cityName: "Lisbon", sessionId: "someone-else" },
    ]);
    expect(keys[1]).toBe("s:someone-else");
  });

  it("forgets the adoption once the URL moves elsewhere, so coming back remounts", () => {
    const keys = walk([
      { message: "cheap", cityName: "Lisbon" },
      { message: "cheap", cityName: "Lisbon", sessionId: "own", adopt: "own" },
      { sessionId: "other" },
      { sessionId: "own" },
    ]);
    expect(keys[2]).toBe("s:other");
    expect(keys[3]).toBe("s:own");
  });

  it("remounts for a Retry that lands on the same route with a new query", () => {
    const keys = walk([{ sessionId: "failed" }, { message: "cheap", cityName: "Lisbon" }]);
    expect(keys[1]).toBe("q:cheap|Lisbon");
  });
});
