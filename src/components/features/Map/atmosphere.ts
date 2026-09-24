import type mapboxgl from "mapbox-gl";
import { lightPresetFor } from "./style";

export const SOURCE_TERRAIN_DEM = "mapbox-dem";
const TERRAIN_DEM_URL = "mapbox://mapbox.mapbox-terrain-dem-v1";
const TERRAIN_EXAGGERATION = 1.2;

export interface Apply3DOptions {
  /** Raster-DEM terrain. Off on phones, where it costs the most GPU. */
  terrain?: boolean;
}

/**
 * Sets Standard's light preset. Its own call so a colour-mode change can flip
 * day/night in place instead of reloading the style and re-attaching layers.
 */
export const applyLightPreset = (map: mapboxgl.Map, isDark: boolean) => {
  try {
    map.setConfigProperty("basemap", "lightPreset", lightPresetFor(isDark));
  } catch {
    // Non-Standard style — config properties don't apply.
  }
};

/**
 * Turns the Standard basemap into a 3D city — light preset, 3D objects
 * (buildings and landmarks), terrain, and atmospheric fog.
 *
 * Only does anything on Standard-family styles: `resolveMapStyle` guarantees a
 * 3D map gets one. Each block is individually try/caught because a wrong guess
 * (a classic style, a projection without fog) should be a silent no-op rather
 * than a thrown error mid-render.
 *
 * Idempotent: it re-runs on every `style.load` and on colour-mode changes, so
 * the DEM source is only added when absent.
 */
export const apply3DConfig = (map: mapboxgl.Map, isDark: boolean, options: Apply3DOptions = {}) => {
  applyLightPreset(map, isDark);
  try {
    map.setConfigProperty("basemap", "show3dObjects", true);
  } catch {
    // Non-Standard style — config properties don't apply.
  }
  if (options.terrain) {
    try {
      if (!map.getSource(SOURCE_TERRAIN_DEM)) {
        map.addSource(SOURCE_TERRAIN_DEM, {
          type: "raster-dem",
          url: TERRAIN_DEM_URL,
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: SOURCE_TERRAIN_DEM, exaggeration: TERRAIN_EXAGGERATION });
    } catch {
      /* style not ready or terrain unsupported — stay flat */
    }
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
