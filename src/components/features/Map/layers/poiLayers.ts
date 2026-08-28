import type mapboxgl from "mapbox-gl";
import { LOCI_MAP_CLUSTER_COLOR } from "~/lib/theme-colors";
import {
  LAYER_CLUSTER_COUNT,
  LAYER_CLUSTERS,
  LAYER_POINT_NUMBER,
  LAYER_POINTS,
  LAYER_ROUTES,
  SLOT,
  SOURCE_POIS,
  SOURCE_ROUTES,
  TEXT_FONT,
} from "../constants";

/**
 * Idempotent: (re)creates sources + layers if missing.
 *
 * Safe to call on every style.load / styledata and before each data update —
 * Mapbox Standard can finish (or re-emit) its style after `load`, dropping
 * anything added too early, so we re-ensure rather than assume one-shot setup.
 * Every branch is guarded by an existence check for exactly that reason.
 */
export const ensurePoiLayers = (map: mapboxgl.Map) => {
  if (!map.getSource(SOURCE_ROUTES)) {
    map.addSource(SOURCE_ROUTES, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getSource(SOURCE_POIS)) {
    map.addSource(SOURCE_POIS, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: 14,
    });
  }

  // Route lines (below points).
  if (!map.getLayer(LAYER_ROUTES)) {
    map.addLayer({
      id: LAYER_ROUTES,
      type: "line",
      source: SOURCE_ROUTES,
      slot: SLOT,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3,
        "line-opacity": 0.6,
        "line-dasharray": [2, 1.5],
      },
    });
  }

  // Clustered circles.
  if (!map.getLayer(LAYER_CLUSTERS)) {
    map.addLayer({
      id: LAYER_CLUSTERS,
      type: "circle",
      source: SOURCE_POIS,
      slot: SLOT,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": LOCI_MAP_CLUSTER_COLOR,
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28],
      },
    });
  }
  if (!map.getLayer(LAYER_CLUSTER_COUNT)) {
    map.addLayer({
      id: LAYER_CLUSTER_COUNT,
      type: "symbol",
      source: SOURCE_POIS,
      slot: SLOT,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": TEXT_FONT,
        "text-size": 13,
      },
      paint: { "text-color": "#ffffff" },
    });
  }

  // Unclustered points — colour by day, enlarge when selected.
  if (!map.getLayer(LAYER_POINTS)) {
    map.addLayer({
      id: LAYER_POINTS,
      type: "circle",
      source: SOURCE_POIS,
      slot: SLOT,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 4, 2],
        "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 16, 12],
      },
    });
  }
  if (!map.getLayer(LAYER_POINT_NUMBER)) {
    map.addLayer({
      id: LAYER_POINT_NUMBER,
      type: "symbol",
      source: SOURCE_POIS,
      slot: SLOT,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": ["get", "label"],
        "text-font": TEXT_FONT,
        "text-size": 12,
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#ffffff" },
    });
  }
};

/**
 * Animates the route lines in: opacity 0.15 -> 0.75 over 800ms.
 *
 * Returns the running rAF handle so the caller can cancel it on cleanup.
 */
export const animateRoutes = (map: mapboxgl.Map, previousFrame?: number): number | undefined => {
  if (!map.getLayer(LAYER_ROUTES)) return undefined;
  const start = performance.now();
  const duration = 800;
  let frame: number | undefined;

  const step = (now: number) => {
    if (!map.getLayer(LAYER_ROUTES)) return;
    const t = Math.min(1, (now - start) / duration);
    map.setPaintProperty(LAYER_ROUTES, "line-opacity", 0.15 + t * 0.6);
    if (t < 1) frame = requestAnimationFrame(step);
  };

  if (previousFrame) cancelAnimationFrame(previousFrame);
  map.setPaintProperty(LAYER_ROUTES, "line-opacity", 0.15);
  frame = requestAnimationFrame(step);
  return frame;
};
