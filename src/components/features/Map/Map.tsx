import { onMount, onCleanup, createEffect, mergeProps } from "solid-js";
import mapboxgl from "mapbox-gl";
import { useTheme } from "~/contexts/ThemeContext";
import { colorForMapDay, LOCI_MAP_CLUSTER_COLOR, mapStyleForColorMode } from "~/lib/theme-colors";

export interface POI {
  id: string;
  name: string;
  category: string;
  latitude: number | string;
  longitude: number | string;
  /** itinerary day index (0-based). Drives marker/route colour. */
  day?: number;
  /** 1-based stop number within the itinerary; falls back to array order. */
  seq?: number;
  priority?: number;
  rating?: number;
  timeToSpend?: string;
  budget?: string;
  dogFriendly?: boolean;
}

interface MapComponentProps {
  center: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  pointsOfInterest: POI[];
  style?: string;
  showRoutes?: boolean;
  /** Selected POI id — flies to + opens its popup + enlarges the marker. */
  selectedId?: string;
  /** Fired on single click of a point (light selection — syncs the list). */
  onSelect?: (poi: POI, index: number) => void;
  /** Fired on a deliberate "open" action (popup button) — opens detail. */
  onActivate?: (poi: POI, index: number) => void;
  /** Swap Mapbox light/dark basemap when color mode changes. Default true. */
  followColorMode?: boolean;
  /** When true, map fills container edge-to-edge (no inset radius). */
  fullBleed?: boolean;
  /** 3D camera + buildings + globe (Mapbox Standard). Default true. */
  enable3D?: boolean;
  /** Initial camera pitch in degrees. Defaults to 48 when enable3D, else 0. */
  pitch?: number;
  /** Auto camera fly-through of the itinerary stops on load. Default false. */
  cinematic?: boolean;
}

const SOURCE_POIS = "loci-pois";
const SOURCE_ROUTES = "loci-routes";
const LAYER_CLUSTERS = "loci-clusters";
const LAYER_CLUSTER_COUNT = "loci-cluster-count";
const LAYER_POINTS = "loci-points";
const LAYER_POINT_NUMBER = "loci-point-number";
const LAYER_ROUTES = "loci-routes-line";

const toNum = (v: number | string): number => (typeof v === "string" ? parseFloat(v) : v);

const isValidPoi = (poi: POI): boolean => {
  if (!poi) return false;
  const lat = toNum(poi.latitude);
  const lng = toNum(poi.longitude);
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
};

const MapComponent = (_props: MapComponentProps) => {
  const props = mergeProps(
    {
      style: "mapbox://styles/mapbox/standard",
      showRoutes: true,
      followColorMode: true,
      enable3D: true,
      cinematic: false,
    },
    _props,
  );
  const theme = useTheme();
  let mapContainer: HTMLDivElement | undefined;
  let map: mapboxgl.Map | undefined;
  let activeStyleUrl: string | undefined;
  let popup: mapboxgl.Popup | undefined;
  let updateTimer: ReturnType<typeof setTimeout> | undefined;
  let handlersBound = false;
  // name -> numeric feature id, so we can drive feature-state for selection.
  const featureIdByName = new Map<string, number>();
  // numeric feature id -> POI, for click + selection lookups.
  const poiByFeatureId = new Map<number, { poi: POI; index: number }>();
  let selectedFeatureId: number | null = null;

  const resolveMapStyle = () =>
    props.followColorMode ? mapStyleForColorMode(theme.isDark()) : props.style;

  // Tier 0: turn the flat Standard basemap into a 3D city — light preset, 3D
  // objects (buildings), and atmospheric fog for the globe. Safe no-ops if the
  // Standard config isn't available (e.g. a non-Standard style).
  const apply3DConfig = () => {
    if (!map || !props.enable3D) return;
    try {
      map.setConfigProperty("basemap", "lightPreset", theme.isDark() ? "night" : "day");
      map.setConfigProperty("basemap", "show3dObjects", true);
    } catch {
      // Non-Standard style — config properties don't apply.
    }
    try {
      map.setFog({
        range: [1, 12],
        "horizon-blend": 0.2,
        color: theme.isDark() ? "#0b1220" : "#dfe8f5",
        "high-color": theme.isDark() ? "#0a0f1e" : "#a9c6ff",
        "space-color": theme.isDark() ? "#05070d" : "#0a1a3a",
        "star-intensity": theme.isDark() ? 0.35 : 0.0,
      });
    } catch {
      /* fog unsupported on this projection/style */
    }
  };

  // Tier 1: cinematic camera fly-through of the itinerary stops, in order.
  // Chained eased moves with pitch + a slow bearing sweep. Cancelled if the user
  // interacts with the map.
  let cinematicCancelled = false;
  const flyThroughItinerary = () => {
    if (!map) return;
    const stops = props.pointsOfInterest
      .filter(isValidPoi)
      .slice()
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    if (stops.length === 0) return;

    const cancel = () => {
      cinematicCancelled = true;
    };
    map.once("dragstart", cancel);
    map.once("zoomstart", cancel);

    let i = 0;
    const step = () => {
      if (!map || cinematicCancelled || i >= stops.length) return;
      const s = stops[i];
      map.flyTo({
        center: [toNum(s.longitude), toNum(s.latitude)],
        zoom: 16.5,
        pitch: 62,
        bearing: (map.getBearing() + 55) % 360,
        speed: 0.6,
        curve: 1.5,
        essential: true,
      });
      i += 1;
      window.setTimeout(step, 3400);
    };
    // Small delay so the first move starts after the intro settles.
    window.setTimeout(step, 900);
  };

  const buildPopupContent = (poi: POI, index: number) => {
    const isMobile = mapContainer ? mapContainer.offsetWidth < 768 : true;
    const container = document.createElement("div");
    container.className = `map-popup p-3 ${isMobile ? "min-w-[180px] max-w-[250px]" : "min-w-[200px] max-w-[300px]"}`;

    const title = document.createElement("h3");
    title.className = `map-popup__title mb-1 ${isMobile ? "text-sm" : "text-base"}`;
    title.textContent = poi.name;
    container.appendChild(title);

    const category = document.createElement("p");
    category.className = `map-popup__meta mb-2 ${isMobile ? "text-xs" : "text-sm"}`;
    category.textContent = poi.category;
    container.appendChild(category);

    const meta = document.createElement("div");
    meta.className = `map-popup__meta flex items-center justify-between ${isMobile ? "text-xs" : "text-sm"}`;
    if (poi.rating != null) {
      const rating = document.createElement("span");
      rating.className = "font-coord";
      rating.textContent = `${poi.rating.toFixed(1)} rating`;
      meta.appendChild(rating);
    }
    if (poi.timeToSpend) {
      const time = document.createElement("span");
      time.textContent = poi.timeToSpend;
      meta.appendChild(time);
    }
    if (poi.budget) {
      const budget = document.createElement("span");
      budget.className = "font-medium";
      budget.textContent = poi.budget;
      meta.appendChild(budget);
    }
    container.appendChild(meta);

    if (poi.dogFriendly) {
      const badge = document.createElement("div");
      badge.className = `map-popup__badge ui-label mt-2 ${isMobile ? "text-xs" : "text-sm"} px-2 py-1 rounded-md inline-block`;
      badge.textContent = "Dog friendly";
      container.appendChild(badge);
    }

    if (props.onActivate) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "map-popup__btn mt-3 w-full text-sm font-medium rounded-md px-3 py-1.5 transition-colors";
      btn.textContent = "View details";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        props.onActivate?.(poi, index);
      });
      container.appendChild(btn);
    }

    return container;
  };

  /** Build the FeatureCollections for points and per-day route lines. */
  const buildData = (pois: POI[]) => {
    featureIdByName.clear();
    poiByFeatureId.clear();

    const valid = pois.filter(isValidPoi);
    const pointFeatures: GeoJSON.Feature[] = valid.map((poi, i) => {
      const fid = i + 1;
      featureIdByName.set(poi.name, fid);
      poiByFeatureId.set(fid, { poi, index: i });
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
    const routeFeatures: GeoJSON.Feature[] = [];
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
      points: { type: "FeatureCollection", features: pointFeatures } as GeoJSON.FeatureCollection,
      routes: { type: "FeatureCollection", features: routeFeatures } as GeoJSON.FeatureCollection,
      valid,
    };
  };

  const fitToData = (valid: POI[]) => {
    if (!map || valid.length === 0) return;
    try {
      const bounds = new mapboxgl.LngLatBounds();
      valid.forEach((poi) => bounds.extend([toNum(poi.longitude), toNum(poi.latitude)]));
      const isMobile = mapContainer ? mapContainer.offsetWidth < 768 : true;
      map.fitBounds(bounds, {
        padding: isMobile ? 30 : 60,
        maxZoom: isMobile ? 14 : 16,
      });
    } catch (error) {
      console.error("Error fitting bounds:", error);
    }
  };

  let routeAnimFrame: number | undefined;

  const animateRoutes = () => {
    if (!map || !map.getLayer(LAYER_ROUTES)) return;
    const start = performance.now();
    const duration = 800;
    const step = (now: number) => {
      if (!map?.getLayer(LAYER_ROUTES)) return;
      const t = Math.min(1, (now - start) / duration);
      map.setPaintProperty(LAYER_ROUTES, "line-opacity", 0.15 + t * 0.6);
      if (t < 1) routeAnimFrame = requestAnimationFrame(step);
    };
    if (routeAnimFrame) cancelAnimationFrame(routeAnimFrame);
    map.setPaintProperty(LAYER_ROUTES, "line-opacity", 0.15);
    routeAnimFrame = requestAnimationFrame(step);
  };

  /** Update source data in place — no marker teardown/rebuild churn. */
  const updateData = (pois: POI[], fit = true) => {
    if (!map) return;
    // Standard style reports isStyleLoaded() === false while imports finish, so
    // we gate on the source existing (ensureLayers re-creates it if dropped)
    // rather than on isStyleLoaded — that gate was eating the markers.
    ensureLayers();
    const source = map.getSource(SOURCE_POIS) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    const { points, routes, valid } = buildData(pois);
    source.setData(points);
    (map.getSource(SOURCE_ROUTES) as mapboxgl.GeoJSONSource | undefined)?.setData(routes);
    if (routes.features.length > 0) animateRoutes();
    if (fit) fitToData(valid);
    // Re-apply selection if the selected POI is still present.
    applySelection(props.selectedId);
  };

  const setFeatureSelected = (fid: number | null, selected: boolean) => {
    if (!map || fid == null) return;
    try {
      map.setFeatureState({ source: SOURCE_POIS, id: fid }, { selected });
    } catch {
      /* source may not be ready yet */
    }
  };

  const applySelection = (selectedId?: string) => {
    if (!map) return;
    const nextId = selectedId ? (featureIdByName.get(selectedId) ?? null) : null;
    if (selectedFeatureId === nextId) return;
    setFeatureSelected(selectedFeatureId, false);
    selectedFeatureId = nextId;
    setFeatureSelected(selectedFeatureId, true);

    if (nextId != null) {
      const entry = poiByFeatureId.get(nextId);
      if (entry) {
        const lngLat: [number, number] = [toNum(entry.poi.longitude), toNum(entry.poi.latitude)];
        map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 14), speed: 1.2 });
        popup
          ?.setLngLat(lngLat)
          .setDOMContent(buildPopupContent(entry.poi, entry.index))
          .addTo(map);
      }
    } else {
      popup?.remove();
    }
  };

  // Idempotent: (re)creates sources + layers if missing. Safe to call on every
  // style.load / styledata and before each data update — Mapbox Standard can
  // finish (or re-emit) its style after `load`, dropping anything we added too
  // early, so we re-ensure rather than assume one-shot setup.
  const ensureLayers = () => {
    if (!map) return;
    // `slot: "top"` keeps custom layers above the Standard basemap. Ignored
    // (harmless) on classic styles.
    const SLOT = "top";
    // Font from the mapbox glyph stack so symbol text renders on any style.
    const TEXT_FONT = ["Open Sans Bold", "Arial Unicode MS Bold"];

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

    bindHandlers();
  };

  const bindHandlers = () => {
    if (!map || handlersBound) return;
    handlersBound = true;

    // Click a cluster -> zoom into it.
    map.on("click", LAYER_CLUSTERS, (e) => {
      const feature = e.features?.[0];
      const clusterId = feature?.properties?.cluster_id;
      const source = map!.getSource(SOURCE_POIS) as mapboxgl.GeoJSONSource;
      if (clusterId == null) return;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map!.easeTo({
          center: (feature!.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom: zoom ?? map!.getZoom() + 1,
        });
      });
    });

    // Click a point -> select + popup.
    map.on("click", LAYER_POINTS, (e) => {
      const feature = e.features?.[0];
      const fid = feature?.id as number | undefined;
      if (fid == null) return;
      const entry = poiByFeatureId.get(fid);
      if (!entry) return;
      props.onSelect?.(entry.poi, entry.index);
      applySelection(entry.poi.name);
    });

    const pointer = (layer: string) => {
      map!.on("mouseenter", layer, () => (map!.getCanvas().style.cursor = "pointer"));
      map!.on("mouseleave", layer, () => (map!.getCanvas().style.cursor = ""));
    };
    pointer(LAYER_POINTS);
    pointer(LAYER_CLUSTERS);
  };

  onMount(() => {
    mapboxgl.accessToken = (import.meta as any).env.VITE_MAPBOX_API_KEY;

    let validCenter: [number, number] = [-8.6291, 41.1579]; // Porto fallback
    if (Array.isArray(props.center) && props.center.length === 2) {
      const [lng, lat] = props.center;
      if (
        typeof lng === "number" &&
        typeof lat === "number" &&
        !isNaN(lng) &&
        !isNaN(lat) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        !(lat === 0 && lng === 0)
      ) {
        validCenter = props.center;
      }
    }

    const initialStyle = resolveMapStyle();
    activeStyleUrl = initialStyle;

    const initialPitch = props.pitch ?? (props.enable3D ? 48 : 0);

    map = new mapboxgl.Map({
      container: mapContainer!,
      style: initialStyle,
      center: validCenter,
      zoom: props.zoom || 12,
      minZoom: props.minZoom || 2,
      maxZoom: props.maxZoom || 20,
      pitch: initialPitch,
      bearing: props.enable3D ? -18 : 0,
      // Globe projection for a rounded-earth discovery view; antialias smooths
      // the Standard style's 3D building edges.
      projection: props.enable3D ? "globe" : "mercator",
      antialias: true,
    });
    map.getContainer().setAttribute("aria-label", "Map of itinerary points of interest");

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      }),
      "top-right",
    );

    popup = new mapboxgl.Popup({ offset: 18, closeButton: true, closeOnClick: false });

    // style.load fires once the style (including Standard's imported fragments)
    // is ready — `load` alone is too early on Standard and left layers empty.
    map.on("style.load", () => {
      if (!map) return;
      apply3DConfig();
      ensureLayers();
      updateData(props.pointsOfInterest, true);
      if (props.cinematic) flyThroughItinerary();
    });

    // If Standard re-emits style data and drops our layers, re-add them and
    // re-push the current data (no auto-fit, to avoid yanking the viewport).
    map.on("styledata", () => {
      if (!map || !map.isStyleLoaded()) return;
      if (!map.getSource(SOURCE_POIS)) {
        ensureLayers();
        updateData(props.pointsOfInterest, false);
      }
    });

    const resizeObserver = new ResizeObserver(() => map && map.resize());
    resizeObserver.observe(mapContainer!);
    onCleanup(() => resizeObserver.disconnect());
  });

  // Swap basemap when color mode changes.
  createEffect(() => {
    if (!props.followColorMode) return;
    const nextStyle = mapStyleForColorMode(theme.isDark());
    if (!map || activeStyleUrl === nextStyle) return;
    activeStyleUrl = nextStyle;
    map.setStyle(nextStyle);
  });

  // React to POI changes — debounced, in-place source update (no churn).
  createEffect(() => {
    const pois = props.pointsOfInterest;
    if (!map) return;
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      if (!map) return;
      updateData(Array.isArray(pois) ? pois : [], true);
    }, 80);
  });

  // React to external selection (list -> map).
  createEffect(() => {
    const sel = props.selectedId;
    if (!map || !map.getSource(SOURCE_POIS)) return;
    applySelection(sel);
  });

  onCleanup(() => {
    if (updateTimer) clearTimeout(updateTimer);
    if (routeAnimFrame) cancelAnimationFrame(routeAnimFrame);
    popup?.remove();
    if (map) map.remove();
  });

  return (
    <div
      ref={mapContainer}
      role="application"
      aria-label="Itinerary map"
      class={`w-full h-full min-h-[300px] overflow-hidden ${props.fullBleed ? "" : "rounded-lg"}`}
    />
  );
};
export default MapComponent;
