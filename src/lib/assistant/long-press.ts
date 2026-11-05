/** Long enough not to fire on a tap, short enough to feel like holding. */
export const LONG_PRESS_MS = 400;
/** A finger that moves this far is scrolling or dragging, not holding. */
const MOVE_SLOP_PX = 10;

export interface LongPressHandlers {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onContextMenu: (e: Event) => void;
  /** Capture, so the router never sees the click that ends a long press. */
  "oncapture:click": (e: MouseEvent) => void;
}

/**
 * Press and hold on something that is also a link. A tap still follows the link;
 * a hold fires onLongPress and the click it ends in is swallowed.
 */
export function createLongPress(onLongPress: () => void, delay = LONG_PRESS_MS): LongPressHandlers {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let startX = 0;
  let startY = 0;
  let fired = false;

  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  return {
    onPointerDown(e) {
      if (e.button !== 0) return;
      cancel();
      fired = false;
      startX = e.clientX;
      startY = e.clientY;
      timer = setTimeout(() => {
        timer = undefined;
        fired = true;
        onLongPress();
      }, delay);
    },
    onPointerMove(e) {
      if (timer === undefined) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu(e) {
      // Android offers a link's context menu at about the moment a hold fires.
      if (timer !== undefined || fired) e.preventDefault();
    },
    "oncapture:click"(e) {
      if (!fired) return;
      fired = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
