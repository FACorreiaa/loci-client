// @vitest-environment happy-dom
//
// The link button is where a plan is made open to others. It is offered only
// where the page can act on it, and it says which state the plan is in.

import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionToolbar } from "./ActionToolbar";

let host: HTMLDivElement;
let dispose: () => void;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});
afterEach(() => {
  dispose?.();
  host.remove();
});

const linkButton = () =>
  [...host.querySelectorAll("button")].find((b) =>
    /link/i.test(b.getAttribute("aria-label") ?? ""),
  );

describe("ActionToolbar link button", () => {
  it("is absent where the page gives it nothing to open", () => {
    dispose = render(() => <ActionToolbar onSave={() => {}} />, host);
    expect(linkButton()).toBeUndefined();
  });

  it("offers a link for a plan that has none, and opens the choice", () => {
    const open = vi.fn();
    dispose = render(() => <ActionToolbar onLinkSettings={open} />, host);
    expect(linkButton()?.getAttribute("aria-label")).toBe("Get a link to this plan");
    linkButton()?.click();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("says so when anyone with the link can open the plan", () => {
    dispose = render(() => <ActionToolbar onLinkSettings={() => {}} hasLink />, host);
    expect(linkButton()?.getAttribute("aria-label")).toBe("Anyone with the link can open this");
  });
});
