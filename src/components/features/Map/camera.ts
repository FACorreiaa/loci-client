import mapboxgl from "mapbox-gl";
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
 * Returns a cancel function so the caller can also stop it on unmount.
 */
export const startItineraryFlyThrough = (map: mapboxgl.Map, pois: POI[]): (() => void) => {
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
      essential: true,
    });
    i += 1;
    timer = setTimeout(step, 3400);
  };
  // Small delay so the first move starts after the intro settles.
  timer = setTimeout(step, 900);

  return cancel;
};
