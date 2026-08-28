import type { Feature, FeatureCollection } from "geojson";
import { colorForMapDay } from "~/lib/theme-colors";
import { isValidPoi, toNum } from "./geo";
import type { POI } from "./types";

/**
 * Lookup tables tying GeoJSON feature ids back to the POIs they came from.
 *
 * Owned by the component and passed in, rather than module state, so two maps
 * on the same page never share a selection index.
 */
export interface PoiIndex {
  /** name -> numeric feature id, so we can drive feature-state for selection. */
  featureIdByName: Map<string, number>;
  /** numeric feature id -> POI, for click + selection lookups. */
  poiByFeatureId: Map<number, { poi: POI; index: number }>;
}

export const createPoiIndex = (): PoiIndex => ({
  featureIdByName: new Map(),
  poiByFeatureId: new Map(),
});

export interface PoiData {
  points: FeatureCollection;
  routes: FeatureCollection;
  valid: POI[];
}

/** Build the FeatureCollections for points and per-day route lines. */
export const buildPoiData = (pois: POI[], index: PoiIndex): PoiData => {
  index.featureIdByName.clear();
  index.poiByFeatureId.clear();

  const valid = pois.filter(isValidPoi);
  const pointFeatures: Feature[] = valid.map((poi, i) => {
    const fid = i + 1;
    index.featureIdByName.set(poi.name, fid);
    index.poiByFeatureId.set(fid, { poi, index: i });
    return {
      type: "Feature",
      id: fid,
      properties: {
        name: poi.name,
        color: colorForMapDay(poi.day),
        label: String(poi.seq ?? i + 1),
      },
      geometry: { type: "Point", coordinates: [toNum(poi.longitude), toNum(poi.latitude)] },
    };
  });

  // Route lines: one LineString per day (or a single line if no day info),
  // following itinerary order so the path reads as the planned sequence.
  const byDay = new Map<number, [number, number][]>();
  valid.forEach((poi) => {
    const day = typeof poi.day === "number" ? poi.day : 0;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push([toNum(poi.longitude), toNum(poi.latitude)]);
  });
  const routeFeatures: Feature[] = [];
  byDay.forEach((coords, day) => {
    if (coords.length > 1) {
      routeFeatures.push({
        type: "Feature",
        properties: { color: colorForMapDay(day) },
        geometry: { type: "LineString", coordinates: coords },
      });
    }
  });

  return {
    points: { type: "FeatureCollection", features: pointFeatures } as FeatureCollection,
    routes: { type: "FeatureCollection", features: routeFeatures } as FeatureCollection,
    valid,
  };
};
