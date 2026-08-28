import type { Feature } from "geojson";
import { createEffect, onCleanup } from "solid-js";
import type mapboxgl from "mapbox-gl";
import { prefersReducedMotion } from "~/lib/hooks/useInView";
import { SOURCE_GLOBE_MARKER } from "./constants";
import { cumulativeDistances, sampleAlongPath, type LngLat } from "./geo";

/** One sweep of the arc, in ms. */
const SWEEP_MS = 6000;
/** ~30fps. A scrubber does not need 60. */
const FRAME_MS = 33;

export interface ArcPlayheadOptions {
  map: () => mapboxgl.Map | undefined;
  /** Densified great circle for the selected leg, or undefined when none is. */
  arc: () => LngLat[] | undefined;
  /** Pill text, e.g. "drive · 312 km · 3h 20m". Real leg data, never an ETA. */
  label: () => string;
  /** When false the head parks at the midpoint instead of sweeping. */
  active: () => boolean;
}

/**
 * Moves a marker along the selected leg's arc.
 *
 * This is a SCRUBBER, not a vehicle. Loci has no telemetry, so a marker that
 * looked like a live position would be a fabricated metric. Three deliberate
 * consequences:
 *
 *  - It rests static at the arc midpoint and only sweeps while a leg is
 *    actively selected or hovered.
 *  - The motion is linear. Easing implies acceleration, which implies physics,
 *    which implies a vehicle.
 *  - The label carries distance and duration from the real TripLeg row, never
 *    an ETA or a "currently at".
 */
export const useArcPlayhead = (opts: ArcPlayheadOptions) => {
  let frame: number | undefined;
  let cached: { arc: LngLat[]; cumulative: number[] } | undefined;

  const cancel = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  };

  const setAt = (t: number) => {
    const map = opts.map();
    const arc = opts.arc();
    if (!map || !arc || arc.length < 2) return;

    // Recompute cumulative distances only when the arc itself changes — it is
    // O(n) haversines and would otherwise run every frame.
    if (!cached || cached.arc !== arc) {
      cached = { arc, cumulative: cumulativeDistances(arc) };
    }

    const { lngLat, bearing } = sampleAlongPath(arc, cached.cumulative, t);
    const source = map.getSource(SOURCE_GLOBE_MARKER) as mapboxgl.GeoJSONSource | undefined;
    source?.setData({
      type: "Feature",
      properties: { bearing, label: opts.label() },
      geometry: { type: "Point", coordinates: lngLat },
    } as Feature);
  };

  const clear = () => {
    const map = opts.map();
    const source = map?.getSource(SOURCE_GLOBE_MARKER) as mapboxgl.GeoJSONSource | undefined;
    source?.setData({ type: "FeatureCollection", features: [] });
  };

  createEffect(() => {
    cancel();

    const arc = opts.arc();
    if (!arc || arc.length < 2) {
      clear();
      return;
    }

    // Reduced motion parks the head rather than hiding it: the marker still
    // shows where the leg is, it just never moves.
    if (prefersReducedMotion() || !opts.active()) {
      setAt(0.5);
      return;
    }

    const start = performance.now();
    let last = 0;

    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      // Pause off-screen: a hidden tab should not burn a rAF loop.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (now - last < FRAME_MS) return;
      last = now;
      setAt(((now - start) % SWEEP_MS) / SWEEP_MS);
    };

    frame = requestAnimationFrame(step);
  });

  onCleanup(cancel);
};

/**
 * "drive · 312 km · 3h 20m" from real leg values.
 *
 * Omits any part the trip did not record rather than filling it in — a leg with
 * no mode reads "312 km", not "fly · 312 km".
 */
export const formatLegLabel = (mode: string, distanceKm: number, durationMins?: number): string => {
  const parts: string[] = [];
  if (mode) parts.push(mode);
  if (distanceKm > 0) parts.push(`${Math.round(distanceKm).toLocaleString()} km`);
  if (durationMins && durationMins > 0) {
    const h = Math.floor(durationMins / 60);
    const m = Math.round(durationMins % 60);
    parts.push(h > 0 ? `${h}h ${m}m` : `${m}m`);
  }
  return parts.join(" · ");
};
