import { createMemo } from "solid-js";

interface CoordReadoutProps {
  lat: number;
  lng: number;
  /** Last settled value, announced to screen readers. */
  settled?: { lat: number; lng: number };
}

const fmt = (v: number, pos: string, neg: string) =>
  `${Math.abs(v).toFixed(4)}°${v >= 0 ? pos : neg}`;

/**
 * Live camera-centre coordinates.
 *
 * `aria-live="off"` on the visible value is deliberate — it updates every frame
 * while dragging, and a live region there would flood a screen reader with
 * hundreds of announcements. The settled value from `moveend` is announced
 * instead, in the separate polite region below.
 */
export default function CoordReadout(props: CoordReadoutProps) {
  const text = createMemo(() => `${fmt(props.lat, "N", "S")} · ${fmt(props.lng, "E", "W")}`);
  const settledText = createMemo(() =>
    props.settled
      ? `Centred near ${fmt(props.settled.lat, "N", "S")}, ${fmt(props.settled.lng, "E", "W")}`
      : "",
  );

  return (
    <>
      <p class="font-coord text-xs tabular-nums text-muted-foreground" aria-live="off">
        {text()}
      </p>
      <p class="sr-only" aria-live="polite">
        {settledText()}
      </p>
    </>
  );
}
