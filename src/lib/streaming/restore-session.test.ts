// @vitest-environment happy-dom
//
// readCompletedSession touches sessionStorage, which does not exist in the
// default node environment. Without this header every assertion below would
// throw rather than run — the same trap the auth-events tests hit.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMPLETED_SESSION_KEY, hasListContent, readCompletedSession } from "./restore-session";

describe("hasListContent", () => {
  // The blank page: createStreamingSession seeds `data: {}`, an empty object
  // is truthy, and the old `if (!data)` guard let it through as a successful
  // restore. Nothing was then in flight, no error was set, and the panel
  // shimmered forever.
  it("rejects an empty payload", () => {
    expect(hasListContent({}, "hotels")).toBe(false);
  });

  it.each([[null], [undefined], ["not an object"], [42]])("rejects %j", (data) => {
    expect(hasListContent(data, "hotels")).toBe(false);
  });

  it("rejects a payload whose list is present but empty", () => {
    expect(hasListContent({ hotels: [] }, "hotels")).toBe(false);
  });

  it("accepts a payload with results", () => {
    expect(hasListContent({ hotels: [{ name: "Belmond" }] }, "hotels")).toBe(true);
  });

  // A city with no results is still an answer: the header names the place and
  // the list says there was nothing to show. That is different from a payload
  // that says nothing at all.
  it("accepts city data with no results", () => {
    expect(hasListContent({ general_city_data: { city: "Funchal" } }, "hotels")).toBe(true);
  });

  it("looks at the list it was asked about, not any list", () => {
    expect(hasListContent({ restaurants: [{ name: "Kampo" }] }, "hotels")).toBe(false);
  });
});

describe("readCompletedSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  const store = (value: unknown) =>
    sessionStorage.setItem(COMPLETED_SESSION_KEY, JSON.stringify(value));

  it("returns nothing when the session id is empty", () => {
    store({ sessionId: "abc", data: { hotels: [1] } });
    expect(readCompletedSession("")).toBeNull();
  });

  it("returns nothing when storage is empty", () => {
    expect(readCompletedSession("abc")).toBeNull();
  });

  it("matches on the envelope's session id", () => {
    store({ sessionId: "abc", data: { hotels: ["a"] } });
    expect(readCompletedSession("abc")).toEqual({ hotels: ["a"] });
  });

  it("matches on the payload's own session id", () => {
    store({ session_id: "abc", hotels: ["a"] });
    expect(readCompletedSession("abc")).toEqual({
      session_id: "abc",
      hotels: ["a"],
    });
  });

  // The stored session belongs to a different search. Returning it would show
  // one city's results under another's session id.
  it("refuses a session id that does not match", () => {
    store({ sessionId: "abc", data: { hotels: ["a"] } });
    expect(readCompletedSession("xyz")).toBeNull();
  });

  it("survives malformed JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    sessionStorage.setItem(COMPLETED_SESSION_KEY, "{not json");
    expect(readCompletedSession("abc")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
