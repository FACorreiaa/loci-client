import type { Feature, FeatureCollection, Point } from "geojson";
import type mapboxgl from "mapbox-gl";
import { colorForSeverity } from "~/lib/theme-colors";
import type { LocalAlert } from "~/lib/api/localContext";
import { isLocatedAlert } from "~/lib/api/localContext";
import { LAYER_SIGNAL_HALO, LAYER_SIGNAL_POINTS, SLOT, SOURCE_SIGNALS } from "../constants";

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Live-alert overlay: located hazards drawn over the itinerary.
 *
 * Idempotent for the same reason `ensurePoiLayers` is — Mapbox Standard can
 * re-emit its style after `load` and silently drop anything added too early, so
 * every branch is guarded rather than assuming one-shot setup.
 *
 * Visually deliberate: a soft severity-coloured halo with a small solid centre,
 * and no number. POI pins are numbered circles with a white stroke, so a hazard
 * cannot be mistaken for a stop on the trip — which matters, because one is
 * somewhere you chose to go and the other is something happening to you.
 */
export const ensureSignalLayers = (map: mapboxgl.Map) => {
  if (!map.getSource(SOURCE_SIGNALS)) {
    map.addSource(SOURCE_SIGNALS, { type: "geojson", data: EMPTY });
  }

  // Halo first so the solid centre draws on top of it.
  if (!map.getLayer(LAYER_SIGNAL_HALO)) {
    map.addLayer({
      id: LAYER_SIGNAL_HALO,
      type: "circle",
      source: SOURCE_SIGNALS,
      slot: SLOT,
      paint: {
        "circle-color": ["get", "color"],
        "circle-opacity": 0.18,
        // Severity drives size as well as colour, so a serious hazard is
        // legible at the zoom level where you are looking at a whole city.
        "circle-radius": ["interpolate", ["linear"], ["get", "severity"], 0, 18, 1, 34],
      },
    });
  }

  if (!map.getLayer(LAYER_SIGNAL_POINTS)) {
    map.addLayer({
      id: LAYER_SIGNAL_POINTS,
      type: "circle",
      source: SOURCE_SIGNALS,
      slot: SLOT,
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": 6,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
  }
};

/**
 * GeoJSON for the located alerts.
 *
 * Country-scoped alerts — a public holiday, an air-quality reading — are
 * dropped here rather than placed at the city centre. They have no coordinates,
 * and inventing some to make them mappable would put a pin on a claim the data
 * does not support. They still appear in the alert list.
 */
export const buildSignalData = (alerts: LocalAlert[]): FeatureCollection => ({
  type: "FeatureCollection",
  features: alerts.filter(isLocatedAlert).map<Feature<Point>>((a) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [a.lon, a.lat] },
    properties: {
      title: a.title,
      detail: a.detail,
      source: a.source,
      // Zero means "unspecified" on the wire and reads as full weight, so it is
      // normalised here — otherwise an ungraded alert would render smallest.
      severity: a.severity > 0 ? a.severity : 1,
      color: colorForSeverity(a.severity),
    },
  })),
});
