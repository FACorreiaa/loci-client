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

  it("sanitizes an off-site url before it would be relayed to a tab", () => {
    // Mirrors the production relay path's
    // `Object.assign({}, payload, { url: targetUrl(payload) })`: the message
    // posted to a visible tab must carry the same targetUrl-checked url as
    // the notification path, not the raw payload url.
    const evilPayload = { sessionId: "s1", url: "https://evil.example/x" };
    const visible = { visibilityState: "visible", url: "https://lociai.fyi/nearme" };

    const d = pushSw.decide(evilPayload, [visible]);
    expect(d).toEqual({ kind: "relay", client: visible });

    const sanitized = Object.assign({}, evilPayload, { url: pushSw.targetUrl(evilPayload) });
    expect(sanitized).toEqual({ sessionId: "s1", url: "/" });
  });
});

describe("push-sw pickTab", () => {
  const origin = "https://lociai.fyi";

  it("picks the same-origin window client", () => {
    const tab = { url: "https://lociai.fyi/nearme" };
    const other = { url: "https://not-loci.example/" };
    expect(pushSw.pickTab([other, tab], origin)).toBe(tab);
  });

  it("returns null when no client matches the origin", () => {
    expect(pushSw.pickTab([{ url: "https://not-loci.example/" }], origin)).toBeNull();
    expect(pushSw.pickTab([], origin)).toBeNull();
    expect(pushSw.pickTab(undefined, origin)).toBeNull();
  });

  it("skips a client whose url cannot be parsed instead of throwing", () => {
    const tab = { url: "https://lociai.fyi/nearme" };
    expect(pushSw.pickTab([{ url: "not a url" }, tab], origin)).toBe(tab);
  });
});
