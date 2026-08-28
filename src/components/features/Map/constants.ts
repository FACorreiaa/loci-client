// Source and layer ids. Shared between the POI map and the globe so a stray
// duplicate id can't collide across the two surfaces.
export const SOURCE_POIS = "loci-pois";
export const SOURCE_ROUTES = "loci-routes";
export const LAYER_CLUSTERS = "loci-clusters";
export const LAYER_CLUSTER_COUNT = "loci-cluster-count";
export const LAYER_POINTS = "loci-points";
export const LAYER_POINT_NUMBER = "loci-point-number";
export const LAYER_ROUTES = "loci-routes-line";

/**
 * `slot: "top"` keeps custom layers above the Standard basemap. Ignored
 * (harmless) on classic styles.
 */
export const SLOT = "top";

/** Font from the mapbox glyph stack so symbol text renders on any style. */
export const TEXT_FONT = ["Open Sans Bold", "Arial Unicode MS Bold"];

export const DEFAULT_MAP_STYLE = "mapbox://styles/mapbox/standard";

// --- Globe surface ---------------------------------------------------------
// Separate ids from the POI map: the two components can, in principle, mount
// at once (globe hero above a POI map), and colliding source ids would have one
// silently overwrite the other's data.
export const SOURCE_GLOBE_NODES = "loci-globe-nodes";
export const SOURCE_GLOBE_ARCS = "loci-globe-arcs";
export const SOURCE_GLOBE_MARKER = "loci-globe-marker";
export const LAYER_GLOBE_ARCS_GLOW = "loci-globe-arcs-glow";
export const LAYER_GLOBE_ARCS = "loci-globe-arcs-line";
export const LAYER_GLOBE_NODES = "loci-globe-nodes-point";
export const LAYER_GLOBE_LABELS = "loci-globe-labels";
export const LAYER_GLOBE_MARKER = "loci-globe-marker-point";
export const LAYER_GLOBE_MARKER_LABEL = "loci-globe-marker-label";

// --- Live signals overlay --------------------------------------------------
// Located alerts (wildfires, cyclones, earthquakes) drawn over the POI map.
// Their own source id so the alert overlay can be toggled, refreshed and
// removed without touching the itinerary data underneath it.
export const SOURCE_SIGNALS = "loci-signals";
export const LAYER_SIGNAL_HALO = "loci-signals-halo";
export const LAYER_SIGNAL_POINTS = "loci-signals-point";

export const IMAGE_PILL = "loci-pill";

/**
 * Satellite basemap for the globe.
 *
 * Standard-family (rather than the classic satellite-streets) so `slot: "top"`
 * layer ordering keeps working — that is what the styledata re-attach guard in
 * useMapLifecycle relies on.
 */
export const GLOBE_STYLE = "mapbox://styles/mapbox/standard-satellite";

/** Classic fallback if the Standard satellite style is unavailable. */
export const GLOBE_STYLE_FALLBACK = "mapbox://styles/mapbox/satellite-streets-v12";

/** Porto. Used when the caller supplies no usable centre. */
export const FALLBACK_CENTER: [number, number] = [-8.6291, 41.1579];
