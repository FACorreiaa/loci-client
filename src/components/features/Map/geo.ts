import type { POI } from "./types";

export const toNum = (v: number | string): number => (typeof v === "string" ? parseFloat(v) : v);

export const isValidPoi = (poi: POI): boolean => {
  if (!poi) return false;
  const lat = toNum(poi.latitude);
  const lng = toNum(poi.longitude);
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
};

/** Longitude/latitude pair, in the order Mapbox and GeoJSON use. */
export type LngLat = [number, number];

export const lngLatOf = (poi: POI): LngLat => [toNum(poi.longitude), toNum(poi.latitude)];

// ---------------------------------------------------------------------------
// Great-circle arcs
//
// Hand-rolled rather than pulling @turf/great-circle: the slerp below is ~20
// lines, whereas turf drags in @turf/helpers + @turf/invariant and returns a
// MultiLineString at the antimeridian that we would have to special-case anyway.
// ---------------------------------------------------------------------------

const RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371.0088;

/** Central angle between two points, in radians. Inputs already in radians. */
const centralAngle = (lat1: number, lon1: number, lat2: number, lon2: number) =>
  2 *
  Math.asin(
    Math.min(
      1,
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    ),
  );

/**
 * Rewrites longitudes so consecutive points never jump more than 180°.
 *
 * Produces values outside [-180, 180] on purpose. Mapbox renders those across
 * the seam correctly; splitting the line into two features instead would leave
 * a visible gap. Without this, an Auckland -> Santiago arc draws as a horizontal
 * streak across the entire map.
 */
export const unwrapAntimeridian = (points: LngLat[]): LngLat[] => {
  let offset = 0;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i][0] - (points[i - 1][0] - offset);
    if (delta > 180) offset -= 360;
    else if (delta < -180) offset += 360;
    points[i][0] += offset;
  }
  return points;
};

/**
 * Densified great circle between two lng/lat points.
 *
 * The densification is mandatory, not cosmetic: Mapbox interpolates line
 * vertices in *projected* space, so a two-point Lisbon -> Tokyo LineString
 * renders as a straight chord through the map rather than as a geodesic.
 * Roughly one vertex per 2° of arc, clamped so short hops stay cheap and long
 * ones stay smooth.
 */
export const greatCircle = (from: LngLat, to: LngLat): LngLat[] => {
  const lon1 = from[0] * RAD;
  const lat1 = from[1] * RAD;
  const lon2 = to[0] * RAD;
  const lat2 = to[1] * RAD;

  const d = centralAngle(lat1, lon1, lat2, lon2);
  // Coincident (or antipodal-degenerate) endpoints have no unique great circle.
  if (!isFinite(d) || d < 1e-9) return [from, to];

  const n = Math.min(128, Math.max(24, Math.ceil(d / RAD / 2)));
  const sinD = Math.sin(d);
  const out: LngLat[] = [];

  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const a = Math.sin((1 - f) * d) / sinD;
    const b = Math.sin(f * d) / sinD;
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    out.push([Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD]);
  }

  return unwrapAntimeridian(out);
};

/**
 * Great-circle distance in km.
 *
 * Mirrors HaversineKm in internal/domain/travelhistory — a leg's label and its
 * curve must agree about how long it is.
 */
export const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) =>
  EARTH_RADIUS_KM * centralAngle(lat1 * RAD, lon1 * RAD, lat2 * RAD, lon2 * RAD);

/** Forward azimuth from one point to the next, in degrees, normalised 0..360. */
export const bearingBetween = (from: LngLat, to: LngLat): number => {
  const lat1 = from[1] * RAD;
  const lat2 = to[1] * RAD;
  const dLon = (to[0] - from[0]) * RAD;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) / RAD + 360) % 360;
};

/**
 * Cumulative along-path distance for each vertex, starting at 0.
 *
 * Needed so a marker moves at constant ground speed rather than at constant
 * vertices-per-second: slerp output bunches up near the endpoints, and indexing
 * by vertex would make the marker visibly stall there.
 */
export const cumulativeDistances = (points: LngLat[]): number[] => {
  const out: number[] = Array.from({ length: points.length });
  out[0] = 0;
  for (let i = 1; i < points.length; i++) {
    const [lon1, lat1] = points[i - 1];
    const [lon2, lat2] = points[i];
    out[i] = out[i - 1] + haversineKm(lat1, lon1, lat2, lon2);
  }
  return out;
};

/**
 * Point and heading at fraction `t` (0..1) along a densified path, measured by
 * distance rather than by vertex index.
 */
export const sampleAlongPath = (
  points: LngLat[],
  cumulative: number[],
  t: number,
): { lngLat: LngLat; bearing: number } => {
  if (points.length === 0) return { lngLat: [0, 0], bearing: 0 };
  if (points.length === 1) return { lngLat: points[0], bearing: 0 };

  const total = cumulative[cumulative.length - 1];
  if (total <= 0) return { lngLat: points[0], bearing: 0 };

  const target = Math.min(Math.max(t, 0), 1) * total;

  // Linear scan: paths are <= 129 vertices, so a binary search would cost more
  // in complexity than it saves per frame.
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < target) i++;

  const segStart = cumulative[i - 1];
  const segLen = cumulative[i] - segStart;
  const f = segLen > 0 ? (target - segStart) / segLen : 0;

  const [lon1, lat1] = points[i - 1];
  const [lon2, lat2] = points[i];
  return {
    lngLat: [lon1 + (lon2 - lon1) * f, lat1 + (lat2 - lat1) * f],
    bearing: bearingBetween(points[i - 1], points[i]),
  };
};
