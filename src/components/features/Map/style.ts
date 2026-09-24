import { mapStyleForColorMode } from "~/lib/theme-colors";

/** Below this container width the map is on a phone: lower pitch, no terrain. */
export const MOBILE_MAP_WIDTH = 768;

export interface MapStyleInput {
  /** Caller's style (defaults to Mapbox Standard). */
  style: string;
  enable3D: boolean;
  followColorMode: boolean;
  isDark: boolean;
}

/**
 * Which basemap to load.
 *
 * 3D needs Mapbox Standard: buildings, light presets and `slot: "top"` only
 * exist there. On the classic light/dark styles `setConfigProperty("basemap",
 * …)` throws, so resolving a 3D map to a classic style silently left every map
 * flat. With 3D on, dark mode is Standard's `night` light preset instead of a
 * different style; the classic styles are only for flat maps.
 */
export const resolveMapStyle = (o: MapStyleInput): string => {
  if (o.enable3D) return o.style;
  return o.followColorMode ? mapStyleForColorMode(o.isDark) : o.style;
};

/** Standard's light preset for the current colour mode. */
export const lightPresetFor = (isDark: boolean): "day" | "night" => (isDark ? "night" : "day");
