import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLongPress } from "./long-press";

const down = (x = 0, y = 0, button = 0) => ({ button, clientX: x, clientY: y }) as PointerEvent;
const click = () =>
  ({ preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as MouseEvent;

describe("createLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("leaves a tap alone", () => {
    const fire = vi.fn();
    const h = createLongPress(fire);
    h.onPointerDown(down());
    vi.advanceTimersByTime(100);
    h.onPointerUp();
    vi.advanceTimersByTime(1000);
    const c = click();
    h["oncapture:click"](c);
    expect(fire).not.toHaveBeenCalled();
    expect(c.preventDefault).not.toHaveBeenCalled();
  });

  it("fires on a hold and swallows only the click that ends it", () => {
    const fire = vi.fn();
    const h = createLongPress(fire);
    h.onPointerDown(down());
    vi.advanceTimersByTime(400);
    expect(fire).toHaveBeenCalledOnce();
    h.onPointerUp();

    const ending = click();
    h["oncapture:click"](ending);
    expect(ending.preventDefault).toHaveBeenCalled();
    expect(ending.stopPropagation).toHaveBeenCalled();

    const next = click();
    h["oncapture:click"](next);
    expect(next.preventDefault).not.toHaveBeenCalled();
  });

  it("gives up when the finger moves", () => {
    const fire = vi.fn();
    const h = createLongPress(fire);
    h.onPointerDown(down(0, 0));
    h.onPointerMove(down(3, 3));
    vi.advanceTimersByTime(200);
    h.onPointerMove(down(30, 0));
    vi.advanceTimersByTime(1000);
    expect(fire).not.toHaveBeenCalled();
  });

  it("ignores any button but the main one", () => {
    const fire = vi.fn();
    const h = createLongPress(fire);
    h.onPointerDown(down(0, 0, 2));
    vi.advanceTimersByTime(1000);
    expect(fire).not.toHaveBeenCalled();
  });

  it("holds off the context menu while pressing", () => {
    const h = createLongPress(vi.fn());
    const menu = { preventDefault: vi.fn() } as unknown as Event;
    h.onContextMenu(menu);
    expect(menu.preventDefault).not.toHaveBeenCalled();
    h.onPointerDown(down());
    h.onContextMenu(menu);
    expect(menu.preventDefault).toHaveBeenCalledOnce();
  });
});
