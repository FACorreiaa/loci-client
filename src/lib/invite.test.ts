// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearInvite,
  facebookInviteHref,
  inviteMessage,
  pendingInviteCode,
  rememberInvite,
  shareInvite,
  smsInviteHref,
} from "./invite";

const inv = {
  url: "https://lociai.fyi/invite/Ab-_12cd34EF",
  shareText: "I'm using Loci to plan places that fit. Join me:",
};

function setShare(share: ((d: ShareData) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
}

describe("invite links", () => {
  it("puts text and link in one SMS body", () => {
    expect(inviteMessage(inv)).toBe(`${inv.shareText} ${inv.url}`);
    expect(smsInviteHref(inv)).toBe(`sms:?&body=${encodeURIComponent(inviteMessage(inv))}`);
  });

  it("shares only the link with Facebook's sharer", () => {
    expect(facebookInviteHref(inv)).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inv.url)}`,
    );
  });
});

describe("shareInvite", () => {
  afterEach(() => setShare(undefined));

  it("is unavailable without a share sheet", async () => {
    setShare(undefined);
    expect(await shareInvite(inv)).toBe("unavailable");
  });

  it("hands text and url to the sheet separately", async () => {
    const share = vi.fn(async () => {});
    setShare(share);
    expect(await shareInvite(inv)).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Loci", text: inv.shareText, url: inv.url });
  });

  it("tells a dismissed sheet from a broken one", async () => {
    setShare(async () => {
      throw new DOMException("dismissed", "AbortError");
    });
    expect(await shareInvite(inv)).toBe("cancelled");
    setShare(async () => {
      throw new Error("nope");
    });
    expect(await shareInvite(inv)).toBe("failed");
  });
});

describe("pending invite code", () => {
  afterEach(() => {
    vi.useRealTimers();
    clearInvite();
  });

  it("is kept until cleared", () => {
    rememberInvite("Ab-_12cd34EF");
    expect(pendingInviteCode()).toBe("Ab-_12cd34EF");
    clearInvite();
    expect(pendingInviteCode()).toBeUndefined();
  });

  it("goes stale after 30 days", () => {
    vi.useFakeTimers();
    rememberInvite("Ab-_12cd34EF");
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(pendingInviteCode()).toBeUndefined();
  });

  it("ignores codes too long to be one", () => {
    rememberInvite("x".repeat(65));
    expect(pendingInviteCode()).toBeUndefined();
  });
});
