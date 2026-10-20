// @vitest-environment happy-dom

import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import AppButtons, { IOS_BETA_URL, StoreBadge, storeState, type StoreState } from "./AppButtons";
import SocialXLink, { X_PROFILE_URL } from "~/components/SocialXLink";

let dispose: (() => void) | undefined;
let host: HTMLElement;

function mount(fn: () => ReturnType<typeof createComponent>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(fn, host);
  return host;
}

afterEach(() => {
  dispose?.();
  dispose = undefined;
  host?.remove();
});

describe("storeState", () => {
  it("prefers a real listing over a beta invite", () => {
    expect(storeState("https://apps.apple.com/app/id1", "https://testflight.apple.com/x")).toEqual({
      kind: "live",
      href: "https://apps.apple.com/app/id1",
    });
  });

  it("falls back to the beta invite", () => {
    expect(storeState(null, "https://testflight.apple.com/x")).toEqual({
      kind: "beta",
      href: "https://testflight.apple.com/x",
    });
  });

  it("is coming soon with neither", () => {
    expect(storeState(null)).toEqual({ kind: "soon" });
  });
});

describe("AppButtons", () => {
  it("links the App Store badge to TestFlight with a beta caption", () => {
    const el = mount(() => createComponent(AppButtons, {}));
    const apple = el.querySelector('[data-store="apple"]')!;
    const link = apple.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(IOS_BETA_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.querySelector("img")!.getAttribute("src")).toContain(
      "download-on-the-app-store.svg",
    );
    expect(apple.textContent).toContain("Beta · TestFlight");
  });

  it("renders Google Play muted, unlinked, and announced as coming soon", () => {
    const el = mount(() => createComponent(AppButtons, {}));
    const play = el.querySelector('[data-store="google"]')!;
    expect(play.querySelector("a")).toBeNull();
    const muted = play.querySelector('[data-state="soon"]')!;
    expect(muted.className).toContain("grayscale");
    expect(muted.querySelector("img")!.getAttribute("alt")).toBe("Google Play — coming soon");
    expect(play.textContent).toContain("Coming soon");
  });
});

describe("StoreBadge", () => {
  const renderBadge = (state: StoreState) =>
    mount(() => createComponent(StoreBadge, { store: "apple", state }));

  it("drops the caption once a real listing exists", () => {
    const el = renderBadge({ kind: "live", href: "https://apps.apple.com/app/id1" });
    expect(el.querySelector("a")!.getAttribute("href")).toBe("https://apps.apple.com/app/id1");
    expect(el.textContent).not.toContain("Beta");
    expect(el.textContent).not.toContain("Coming soon");
  });

  it("mutes the Apple badge too when there is no iOS link at all", () => {
    const el = renderBadge({ kind: "soon" });
    expect(el.querySelector("a")).toBeNull();
    expect(el.querySelector('[data-state="soon"] img')!.getAttribute("alt")).toBe(
      "App Store — coming soon",
    );
  });
});

describe("SocialXLink", () => {
  it("points at the X profile in a new tab", () => {
    const el = mount(() => createComponent(SocialXLink, {}));
    const link = el.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(X_PROFILE_URL);
    expect(X_PROFILE_URL).toBe("https://x.com/fatc88");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("aria-label")).toBe("Fernando on X");
    expect(link.textContent).toBe("X");
  });
});
