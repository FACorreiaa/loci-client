import type mapboxgl from "mapbox-gl";

/**
 * Turns the flat Standard basemap into a 3D city — light preset, 3D objects
 * (buildings), and atmospheric fog for the globe.
 *
 * Both blocks are individually try/caught because the config properties only
 * exist on Standard-family styles and fog only applies to some projections.
 * A wrong guess is a silent no-op rather than a thrown error mid-render.
 */
export const apply3DConfig = (map: mapboxgl.Map, isDark: boolean) => {
  try {
    map.setConfigProperty("basemap", "lightPreset", isDark ? "night" : "day");
    map.setConfigProperty("basemap", "show3dObjects", true);
  } catch {
    // Non-Standard style — config properties don't apply.
  }
  try {
    map.setFog({
      range: [1, 12],
      "horizon-blend": 0.2,
      color: isDark ? "#0b1220" : "#dfe8f5",
      "high-color": isDark ? "#0a0f1e" : "#a9c6ff",
      "space-color": isDark ? "#05070d" : "#0a1a3a",
      "star-intensity": isDark ? 0.35 : 0.0,
    });
  } catch {
    /* fog unsupported on this projection/style */
  }
};

/**
 * Atmosphere for the whole-planet globe view.
 *
 * `high-color` + `horizon-blend` IS the rim glow — it is Mapbox's physical
 * atmosphere shader, drawn in the right place as the camera moves. Stacking a
 * CSS radial-gradient ring on top to chase a brighter bloom would desync the
 * moment the user pans, because the globe's screen circle moves.
 *
 * Colours are derived from the dark theme tokens (forest ink background, sage
 * primary) rather than the stock Mapbox blue.
 */
export const applyGlobeAtmosphere = (map: mapboxgl.Map, isDark: boolean) => {
  try {
    // Place labels stay; road/POI/transit labels are noise at planet scale.
    map.setConfigProperty("basemap", "showPlaceLabels", true);
    map.setConfigProperty("basemap", "showRoadLabels", false);
    map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
    map.setConfigProperty("basemap", "showTransitLabels", false);
  } catch {
    // Non-Standard style — config properties don't apply.
  }
  try {
    map.setFog({
      range: [0.8, 8],
      // Thin blend = crisp rim. Raise toward 0.15 for a softer halo.
      "horizon-blend": isDark ? 0.06 : 0.1,
      color: isDark ? "#0b1a14" : "#dfe8f5",
      "high-color": isDark ? "#1d4f3f" : "#a9c6ff",
      // Matches --background (157 22% 8%) so the globe sits in the page rather
      // than on it.
      "space-color": isDark ? "#050807" : "#0a1a3a",
      "star-intensity": isDark ? 0.55 : 0.0,
    });
  } catch {
    /* fog unsupported on this projection/style */
  }
};

/**
 * Tears the atmosphere down when leaving globe projection.
 *
 * `space-color` and `star-intensity` are meaningless in mercator, so leaving
 * the fog as-is makes the background jump silently on the 2D toggle.
 */
export const clearGlobeAtmosphere = (map: mapboxgl.Map) => {
  try {
    map.setFog({
      range: [1, 12],
      "horizon-blend": 0.1,
      "star-intensity": 0,
    });
  } catch {
    /* fog unsupported on this projection/style */
  }
};

/**
 * Zoom that fits the whole planet in the container.
 *
 * Heuristic, tuned visually: Mapbox globe zoom is not a linear function of
 * pixel size, so this approximates "planet touches the shorter edge".
 */
export const globeFitZoom = (el: HTMLElement): number => {
  const shorter = Math.min(el.clientWidth || 1024, el.clientHeight || 768);
  return Math.min(3, Math.max(0.6, Math.log2(shorter / 512) + 0.15));
};
