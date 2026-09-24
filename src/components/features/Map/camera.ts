import mapboxgl from "mapbox-gl";
import { prefersReducedMotion } from "~/lib/hooks/useInView";
import { isValidPoi, toNum } from "./geo";
import type { POI } from "./types";

export const fitToData = (map: mapboxgl.Map, valid: POI[], container?: HTMLElement) => {
  if (valid.length === 0) return;
  try {
    const bounds = new mapboxgl.LngLatBounds();
    valid.forEach((poi) => bounds.extend([toNum(poi.longitude), toNum(poi.latitude)]));
    const isMobile = container ? container.offsetWidth < 768 : true;
    map.fitBounds(bounds, {
      padding: isMobile ? 30 : 60,
      maxZoom: isMobile ? 14 : 16,
    });
  } catch (error) {
    console.error("Error fitting bounds:", error);
  }
};

/**
 * Cinematic camera fly-through of the itinerary stops, in order.
 *
 * Chained eased moves with pitch + a slow bearing sweep. Cancels itself as soon
 * as the user touches the map — a camera that keeps flying while someone is
 * trying to pan is the whole reason this needs a cancel path.
 *
 * Does not start at all under `prefers-reduced-motion`: a camera that sweeps
 * on its own for several seconds is exactly what that setting asks us not to do.
 *
 * Returns a cancel function so the caller can also stop it on unmount.
 */
export const startItineraryFlyThrough = (map: mapboxgl.Map, pois: POI[]): (() => void) => {
  if (prefersReducedMotion()) return () => {};

  const stops = pois
    .filter(isValidPoi)
    .slice()
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };

  if (stops.length === 0) return cancel;

  map.once("dragstart", cancel);
  map.once("zoomstart", cancel);

  let i = 0;
  const step = () => {
    if (cancelled || i >= stops.length) return;
    const s = stops[i];
    map.flyTo({
      center: [toNum(s.longitude), toNum(s.latitude)],
      zoom: 16.5,
      pitch: 62,
      bearing: (map.getBearing() + 55) % 360,
      speed: 0.6,
      curve: 1.5,
    });
    i += 1;
    timer = setTimeout(step, 3400);
  };
  // Small delay so the first move starts after the intro settles.
  timer = setTimeout(step, 900);

  return cancel;
};

/**
 * Moves the camera to a point: animated normally, an instant jump under
 * `prefers-reduced-motion`. Mapbox also skips non-essential animations on its
 * own, but saying so here keeps the behaviour explicit and testable.
 */
export const moveCameraTo = (
  map: mapboxgl.Map,
  target: { center: [number, number]; zoom: number },
  kind: "fly" | "ease",
) => {
  if (prefersReducedMotion()) {
    map.jumpTo(target);
  } else if (kind === "fly") {
    map.flyTo({ ...target, speed: 1.2 });
  } else {
    map.easeTo(target);
  }
};
