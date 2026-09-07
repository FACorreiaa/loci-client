import type { DesignTheme } from "~/lib/theme-preference";

/** Browser chrome / PWA theme-color per design + resolved color mode. */
export const THEME_COLOR_PALETTE: Record<DesignTheme, { light: string; dark: string }> = {
  loci: { light: "#FDF5EA", dark: "#323B42" },
  classic: { light: "#8a6e2f", dark: "#5c4033" },
  modern: { light: "#0c7df2", dark: "#1e3a8a" },
};

export const MAPBOX_STYLES = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
} as const;

/**
 * Itinerary day markers and routes: eight categories, anchored on the brand
 * coral and staying in the warm-earthy language the previous scale used.
 *
 * These are markers on a map, so two things had to hold and did not before:
 *
 *   Every colour clears 3:1 against BOTH map styles. The old forest ink
 *   measured 1.7:1 on mapbox/dark-v11 — day-zero pins were close to invisible
 *   for anyone using the dark map.
 *
 *   Adjacent days have to be told apart. The old scale's closest pair was
 *   ΔE(CIEDE2000) 5.1, which is near the threshold at which two colours are the
 *   same colour. The closest pair here is 16.0.
 *
 * They also stay ΔE 12.8 or more from every LOCI_ALERT_COLORS value, so a
 * hazard pin never reads as somebody's day three.
 *
 * Hand-picked rather than optimised: maximising the minimum distance reaches
 * straight for electric magenta and blue, which are as far apart as colours get
 * and nothing to do with this brand.
 */
export const LOCI_DAY_COLORS = [
  "#E2664A", // coral clay (day 0) — the brand coral, darkened until it passes
  "#2F7D6E", // pine teal
  "#B07A2A", // ochre
  "#7A5CA8", // muted plum
  "#4A7CB0", // slate blue
  "#8C6248", // walnut
  "#5E8C3A", // olive
  "#A34F72", // dusty rose
] as const;

/**
 * Alert severity scale, for hazards drawn on the map and severity-coloured
 * rows in the alert list.
 *
 * Still drawn from the warm language of the rest of the map rather than a
 * generic amber/red — a wildfire pin has to read as part of this map, not as a
 * browser error. But the band is now RESERVED: the day colours are chosen from
 * what is left after these three, because the previous palette drew both from
 * one warm vocabulary and ended up with a "field amber" day and a "field amber"
 * minor alert that were the same value.
 *
 * The scale darkens as it climbs, and every step clears 3:1 on both map styles
 * — the old deep rust was 1.8:1 on the dark map, so the most serious hazard was
 * the hardest one to see.
 */
export const LOCI_ALERT_COLORS = {
  minor: "#A5931D", // dry gold
  moderate: "#E3721C", // hot terracotta
  major: "#C63947", // alarm red
} as const;

/** Severity is 0..1 from the server; 0 means unspecified and reads as full. */
export const colorForSeverity = (severity?: number): string => {
  const s = severity == null || severity <= 0 ? 1 : severity;
  if (s >= 0.75) return LOCI_ALERT_COLORS.major;
  if (s >= 0.4) return LOCI_ALERT_COLORS.moderate;
  return LOCI_ALERT_COLORS.minor;
};

/**
 * A cluster bubble is a ground for 13px white text, and it is drawn at 85%
 * opacity — so the colour that matters is the composite over the map beneath.
 * At that alpha over mapbox/light-v11 this gives white 4.7:1, and 7.4:1 over
 * the dark style. The brand coral itself would be 2.8:1 there, which is why
 * this is darker than the day-zero pin it otherwise matches.
 */
export const LOCI_MAP_CLUSTER_COLOR = "#AE3722";

/** Ungrouped pins carry no label and only have to be seen: 4.4:1 / 3.7:1. */
export const LOCI_MAP_UNGROUPED_COLOR = "#6E7A82";

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
