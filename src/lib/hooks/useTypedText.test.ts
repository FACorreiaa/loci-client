// @vitest-environment happy-dom

import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTypedText } from "./useTypedText";

// Effects flush when the root's synchronous body ends, so the hook is set up
// inside createRoot and driven from outside it.
const mount = (live: boolean, opts?: { charsPerTick?: number; tickMs?: number }) =>
  createRoot((dispose) => {
    const [src, setSrc] = createSignal<string | undefined>(undefined);
    const typed = useTypedText(src, () => live, opts);
    return { typed, setSrc, dispose };
  });

describe("useTypedText", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the text whole when the session is not live", () => {
    const h = mount(false);
    h.setSrc("Funchal sits on the south coast.");
    expect(h.typed()).toBe("Funchal sits on the south coast.");
    h.dispose();
  });

  it("types the text out in chunks when live", () => {
    const h = mount(true, { charsPerTick: 4, tickMs: 10 });
    h.setSrc("abcdefghij");
    expect(h.typed()).toBe("");
    vi.advanceTimersByTime(10);
    expect(h.typed()).toBe("abcd");
    vi.advanceTimersByTime(10);
    expect(h.typed()).toBe("abcdefgh");
    vi.advanceTimersByTime(10);
    expect(h.typed()).toBe("abcdefghij");
    vi.advanceTimersByTime(50);
    expect(h.typed()).toBe("abcdefghij");
    h.dispose();
  });

  it("continues from the shared prefix when the same text is re-sent", () => {
    const h = mount(true, { charsPerTick: 2, tickMs: 10 });
    h.setSrc("hello world");
    vi.advanceTimersByTime(30);
    expect(h.typed()).toBe("hello ");
    // Same value: Solid's `on` skips an equal signal, so nothing restarts.
    h.setSrc("hello world");
    expect(h.typed()).toBe("hello ");
    vi.advanceTimersByTime(30);
    expect(h.typed()).toBe("hello world");
    h.dispose();
  });

  it("respects prefers-reduced-motion", () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce") })) as any;
    const h = mount(true);
    h.setSrc("instant");
    expect(h.typed()).toBe("instant");
    h.dispose();
    window.matchMedia = original;
  });
});
