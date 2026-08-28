import type { FeatureCollection } from "geojson";
import type mapboxgl from "mapbox-gl";
import {
  IMAGE_PILL,
  LAYER_GLOBE_ARCS,
  LAYER_GLOBE_ARCS_GLOW,
  LAYER_GLOBE_LABELS,
  LAYER_GLOBE_MARKER,
  LAYER_GLOBE_MARKER_LABEL,
  LAYER_GLOBE_NODES,
  SLOT,
  SOURCE_GLOBE_ARCS,
  SOURCE_GLOBE_MARKER,
  SOURCE_GLOBE_NODES,
  TEXT_FONT,
} from "../constants";

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Globe palette.
 *
 * One constant arc colour rather than a per-trip scale: `line-gradient` needs
 * `lineMetrics` and is incompatible with a data-driven `line-color`, and
 * DESIGN.md names multi-coloured map marks as an anti-pattern anyway.
 */
export interface GlobePalette {
  arc: string;
  node: string;
  nodeStroke: string;
  pillFill: string;
  pillStroke: string;
  pillText: string;
  marker: string;
}

/**
 * Idempotent: (re)creates the globe's sources and layers if missing.
 *
 * Same contract as ensurePoiLayers — Mapbox Standard re-emits its style and
 * drops custom layers, so this runs again whenever the sentinel source has
 * vanished.
 */
export const ensureGlobeLayers = (map: mapboxgl.Map, palette: GlobePalette) => {
  if (!map.getSource(SOURCE_GLOBE_ARCS)) {
    map.addSource(SOURCE_GLOBE_ARCS, {
      type: "geojson",
      // Required by line-gradient below.
      lineMetrics: true,
      data: EMPTY,
    });
  }
  if (!map.getSource(SOURCE_GLOBE_NODES)) {
    map.addSource(SOURCE_GLOBE_NODES, { type: "geojson", data: EMPTY });
  }
  if (!map.getSource(SOURCE_GLOBE_MARKER)) {
    map.addSource(SOURCE_GLOBE_MARKER, { type: "geojson", data: EMPTY });
  }

  // Soft glow under the arc — reads as atmosphere-lit rather than as a drawn line.
  if (!map.getLayer(LAYER_GLOBE_ARCS_GLOW)) {
    map.addLayer({
      id: LAYER_GLOBE_ARCS_GLOW,
      type: "line",
      source: SOURCE_GLOBE_ARCS,
      slot: SLOT,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": palette.arc,
        "line-width": 6,
        "line-opacity": 0.18,
        "line-blur": 4,
      },
    });
  }

  // The arc itself. Fades at both ends so it doesn't terminate in a hard stub
  // where it meets a node.
  if (!map.getLayer(LAYER_GLOBE_ARCS)) {
    map.addLayer({
      id: LAYER_GLOBE_ARCS,
      type: "line",
      source: SOURCE_GLOBE_ARCS,
      slot: SLOT,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-width": 1.6,
        "line-gradient": [
          "interpolate",
          ["linear"],
          ["line-progress"],
          0,
          "rgba(0,0,0,0)",
          0.15,
          palette.arc,
          0.85,
          palette.arc,
          1,
          "rgba(0,0,0,0)",
        ],
      },
    });
  }

  // City nodes. Radius scales with visit count so somewhere returned to five
  // times reads heavier than somewhere passed through once.
  if (!map.getLayer(LAYER_GLOBE_NODES)) {
    map.addLayer({
      id: LAYER_GLOBE_NODES,
      type: "circle",
      source: SOURCE_GLOBE_NODES,
      slot: SLOT,
      paint: {
        "circle-color": palette.node,
        "circle-stroke-color": palette.nodeStroke,
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1.5],
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "weight"], 1],
          1,
          4,
          10,
          9,
        ],
      },
    });
  }

  // Label pills. `*-allow-overlap: false` makes them self-cull on the crowded
  // limb, which is what you want when half the globe is edge-on.
  if (!map.getLayer(LAYER_GLOBE_LABELS)) {
    map.addLayer({
      id: LAYER_GLOBE_LABELS,
      type: "symbol",
      source: SOURCE_GLOBE_NODES,
      slot: SLOT,
      layout: {
        "icon-image": IMAGE_PILL,
        "icon-text-fit": "both",
        "icon-text-fit-padding": [6, 10, 6, 10],
        "icon-anchor": "bottom",
        "text-anchor": "bottom",
        "text-offset": [0, -1.1],
        "text-field": ["get", "label"],
        "text-font": TEXT_FONT,
        "text-size": 11,
        "icon-allow-overlap": false,
        "text-allow-overlap": false,
        "icon-optional": false,
        // Busier places win the space when labels collide.
        "symbol-sort-key": ["-", 0, ["coalesce", ["get", "weight"], 1]],
      },
      paint: { "text-color": palette.pillText },
    });
  }

  // Leg scrubber. A neutral dot, never a vehicle glyph: Loci has no telemetry,
  // and a plane on a moving arc would read as live tracking.
  if (!map.getLayer(LAYER_GLOBE_MARKER)) {
    map.addLayer({
      id: LAYER_GLOBE_MARKER,
      type: "circle",
      source: SOURCE_GLOBE_MARKER,
      slot: SLOT,
      paint: {
        "circle-color": palette.marker,
        "circle-radius": 6,
        "circle-stroke-color": palette.nodeStroke,
        "circle-stroke-width": 2,
      },
    });
  }

  if (!map.getLayer(LAYER_GLOBE_MARKER_LABEL)) {
    map.addLayer({
      id: LAYER_GLOBE_MARKER_LABEL,
      type: "symbol",
      source: SOURCE_GLOBE_MARKER,
      slot: SLOT,
      layout: {
        "icon-image": IMAGE_PILL,
        "icon-text-fit": "both",
        "icon-text-fit-padding": [5, 9, 5, 9],
        "icon-anchor": "top",
        "text-anchor": "top",
        "text-offset": [0, 1.0],
        // Distance and duration from the real leg. Never an ETA, never a
        // position — this is a scrubber, not a tracker.
        "text-field": ["get", "label"],
        "text-font": TEXT_FONT,
        "text-size": 10,
        "icon-allow-overlap": true,
        "text-allow-overlap": true,
      },
      paint: { "text-color": palette.pillText },
    });
  }
};

/** Great-circle arcs as a FeatureCollection of densified LineStrings. */
export const buildArcData = (
  arcs: { points: [number, number][]; properties: Record<string, unknown> }[],
): FeatureCollection => ({
  type: "FeatureCollection",
  features: arcs.map((a) => ({
    type: "Feature",
    properties: a.properties,
    geometry: { type: "LineString", coordinates: a.points },
  })),
});

export const buildNodeData = (
  nodes: { lngLat: [number, number]; label: string; weight: number; id: string }[],
): FeatureCollection => ({
  type: "FeatureCollection",
  features: nodes.map((n, i) => ({
    type: "Feature",
    id: i + 1,
    properties: { label: n.label, weight: n.weight, cityId: n.id },
    geometry: { type: "Point", coordinates: n.lngLat },
  })),
});
