import type { DesignTheme } from "~/lib/theme-preference";

/** Browser chrome / PWA theme-color per design + resolved color mode. */
export const THEME_COLOR_PALETTE: Record<DesignTheme, { light: string; dark: string }> = {
  loci: { light: "#294d3c", dark: "#14251e" },
  classic: { light: "#8a6e2f", dark: "#5c4033" },
  modern: { light: "#0c7df2", dark: "#1e3a8a" },
};

export const MAPBOX_STYLES = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
} as const;

/** Itinerary day marker + route colors — forest → sage → terracotta scale. */
export const LOCI_DAY_COLORS = [
  "#294d3c", // forest ink (day 0)
  "#5a7a55", // sage
  "#c76b4a", // terracotta
  "#8a6e2f", // field amber
  "#3d5a4a", // deep sage
  "#a85a3a", // burnt terracotta
  "#6b8f71", // light sage
  "#d4845c", // warm clay
] as const;

/**
 * Alert severity scale, for hazards drawn on the map and severity-coloured
 * rows in the alert list.
 *
 * Deliberately drawn from the same earthy language as the day colours rather
 * than a generic amber/red warning palette — a wildfire pin has to read as part
 * of this map, not as a browser error. It stays distinguishable from the day
 * scale because it climbs in saturation towards rust, which the day colours
 * never reach.
 */
export const LOCI_ALERT_COLORS = {
  minor: "#8a6e2f", // field amber
  moderate: "#c76b4a", // terracotta
  major: "#8c2f1f", // deep rust
} as const;

/** Severity is 0..1 from the server; 0 means unspecified and reads as full. */
export const colorForSeverity = (severity?: number): string => {
  const s = severity == null || severity <= 0 ? 1 : severity;
  if (s >= 0.75) return LOCI_ALERT_COLORS.major;
  if (s >= 0.4) return LOCI_ALERT_COLORS.moderate;
  return LOCI_ALERT_COLORS.minor;
};

export const LOCI_MAP_CLUSTER_COLOR = "#294d3c";
export const LOCI_MAP_UNGROUPED_COLOR = "#6b7c72";

export const themeColorFor = (design: DesignTheme, isDark: boolean): string =>
  THEME_COLOR_PALETTE[design][isDark ? "dark" : "light"];

/** Reads `--theme-color` set in app.css for the active theme. */
export const readThemeColorFromDocument = (): string => {
  if (typeof document === "undefined") return THEME_COLOR_PALETTE.loci.light;

  const value = getComputedStyle(document.documentElement).getPropertyValue("--theme-color").trim();
  return value || THEME_COLOR_PALETTE.loci.light;
};

export const mapStyleForColorMode = (isDark: boolean): string =>
  isDark ? MAPBOX_STYLES.dark : MAPBOX_STYLES.light;

export const colorForMapDay = (day?: number): string =>
  typeof day === "number"
    ? LOCI_DAY_COLORS[day % LOCI_DAY_COLORS.length]
    : LOCI_MAP_UNGROUPED_COLOR;
