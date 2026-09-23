import { describe, expect, it } from "vitest";
import { shouldOfferPush } from "./prompt-rules";

const DAY = 86_400_000;
describe("shouldOfferPush", () => {
  const base = { permission: "default" as const, hasKey: true, dismissedAt: null, now: 100 * DAY };
  it("offers when it could help and was never declined", () =>
    expect(shouldOfferPush(base)).toBe(true));
  it("never re-asks a browser that blocked us", () =>
    expect(shouldOfferPush({ ...base, permission: "denied" })).toBe(false));
  it("does not offer what the server cannot send", () =>
    expect(shouldOfferPush({ ...base, hasKey: false })).toBe(false));
  it("waits 30 days after Not now", () => {
    expect(shouldOfferPush({ ...base, dismissedAt: base.now - 29 * DAY })).toBe(false);
    expect(shouldOfferPush({ ...base, dismissedAt: base.now - 31 * DAY })).toBe(true);
  });
  it("has nothing to offer once granted", () =>
    expect(shouldOfferPush({ ...base, permission: "granted" })).toBe(false));
});
