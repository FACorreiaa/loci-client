// @vitest-environment happy-dom
//
// The consent gate as a person meets it: the real section, a real checkbox,
// and the request fields a save would send.

import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AccessibilityNeedsSection from "./AccessibilityNeedsSection";
import {
  accessibilityFormFor,
  accessibilityUpdateFields,
  emptyNeeds,
  type AccessibilityFormState,
} from "~/lib/accessibility";

let host: HTMLDivElement;
let dispose: () => void;
let state: () => AccessibilityFormState;

const mount = (initial: AccessibilityFormState) => {
  const [s, setS] = createSignal(initial);
  state = s;
  dispose = render(() => <AccessibilityNeedsSection state={s()} onChange={setS} />, host);
};

const q = <T extends Element>(sel: string) => host.querySelector<T>(sel);
const fields = () => q<HTMLFieldSetElement>('[data-testid="accessibility-fields"]')!;
const consent = () => q<HTMLInputElement>('[data-testid="accessibility-consent"]');
const toggle = (label: string) => {
  const box = [...host.querySelectorAll("label")]
    .find((l) => l.textContent?.trim() === label)!
    .querySelector("input")!;
  box.click();
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});
afterEach(() => {
  dispose?.();
  host.remove();
});

describe("AccessibilityNeedsSection", () => {
  it("starts locked behind an unticked consent box", () => {
    mount(accessibilityFormFor(null));
    expect(consent()!.checked).toBe(false);
    expect(fields().disabled).toBe(true);
    expect(consent()!.getAttribute("aria-describedby")).toBe("accessibility-consent-explanation");
  });

  it("unlocks once consent is given, and records the choice", () => {
    mount(accessibilityFormFor(null));
    consent()!.click();
    expect(fields().disabled).toBe(false);
    toggle("Blind");
    expect(state().consentGiven).toBe(true);
    expect(state().needs.blind).toBe(true);
  });

  it("shows the slope choice only when routes must be step-free", () => {
    mount({ ...accessibilityFormFor(null), consentGiven: true });
    const slopes = () => [...host.querySelectorAll("span")].some((s) => s.textContent === "Slopes");
    expect(slopes()).toBe(false);
    toggle("Step-free routes and entrances only");
    expect(slopes()).toBe(true);
  });

  it("opens stored needs unlocked, without asking again", () => {
    mount(accessibilityFormFor({ ...emptyNeeds(), blind: true }));
    expect(consent()).toBeNull();
    expect(fields().disabled).toBe(false);
  });

  it("deletes stored needs, locks the form and asks for consent again", () => {
    mount(accessibilityFormFor({ ...emptyNeeds(), blind: true }));
    q<HTMLButtonElement>('[data-testid="accessibility-delete"]')!.click();
    expect(fields().disabled).toBe(true);
    expect(consent()!.checked).toBe(false);
    expect(host.textContent).toContain("will be deleted when you save");
    expect(accessibilityUpdateFields(state())).toEqual({ clearAccessibilityNeeds: true });
  });
});
