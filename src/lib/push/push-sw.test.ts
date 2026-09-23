import { describe, expect, it } from "vitest";
// Plain script, not a module: it attaches to globalThis and, under vitest, to module.exports.
import pushSw from "../../../public/push-sw.js";

const payload = {
  sessionId: "s1",
  title: "Your Crete itinerary is ready",
  body: "Tap to open it.",
  url: "/itinerary?sessionId=s1",
};

describe("push-sw decide", () => {
  it("relays to a visible Loci tab instead of a system notification", () => {
    const visible = { visibilityState: "visible", url: "https://lociai.fyi/nearme" };
    expect(pushSw.decide(payload, [visible])).toEqual({ kind: "relay", client: visible });
  });

  it("shows a notification when every tab is hidden", () => {
    expect(
      pushSw.decide(payload, [{ visibilityState: "hidden", url: "https://lociai.fyi/" }]),
    ).toEqual({
      kind: "show",
    });
    expect(pushSw.decide(payload, [])).toEqual({ kind: "show" });
  });

  it("only follows same-site paths on click", () => {
    expect(pushSw.targetUrl({ url: "/itinerary?sessionId=s1" })).toBe("/itinerary?sessionId=s1");
    expect(pushSw.targetUrl({ url: "https://evil.example/x" })).toBe("/");
  });

  it("rejects a protocol-relative path", () => {
    expect(pushSw.targetUrl({ url: "//evil.example/x" })).toBe("/");
  });

  it("rejects anything not starting with a single slash", () => {
    expect(pushSw.targetUrl({ url: "evil.example/x" })).toBe("/");
  });

  it("rejects a backslash right after the leading slash", () => {
    expect(pushSw.targetUrl({ url: "/\\evil.example/x" })).toBe("/");
  });
});
