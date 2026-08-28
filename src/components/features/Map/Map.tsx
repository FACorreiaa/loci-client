import { createEffect, mergeProps, onCleanup } from "solid-js";
import type { Point } from "geojson";
import mapboxgl from "mapbox-gl";
import { useTheme } from "~/contexts/ThemeContext";
import { mapStyleForColorMode } from "~/lib/theme-colors";
import { apply3DConfig } from "./atmosphere";
import { fitToData, startItineraryFlyThrough } from "./camera";
import {
  DEFAULT_MAP_STYLE,
  FALLBACK_CENTER,
  LAYER_CLUSTER_COUNT,
  LAYER_CLUSTERS,
  LAYER_POINT_NUMBER,
  LAYER_POINTS,
  LAYER_ROUTES,
  LAYER_SIGNAL_HALO,
  LAYER_SIGNAL_POINTS,
  SOURCE_POIS,
  SOURCE_ROUTES,
  SOURCE_SIGNALS,
} from "./constants";
import { buildPoiData, createPoiIndex } from "./data";
import { toNum } from "./geo";
import { animateRoutes, ensurePoiLayers } from "./layers/poiLayers";
import { buildSignalData, ensureSignalLayers } from "./layers/signalLayers";
import { buildPopupContent } from "./popup";
import type { MapComponentProps, POI } from "./types";
import { useMapLifecycle } from "./useMapLifecycle";

const MapComponent = (_props: MapComponentProps) => {
  const props = mergeProps(
    {
      style: DEFAULT_MAP_STYLE,
      showRoutes: true,
      showAlerts: true,
      showStops: true,
      followColorMode: true,
      enable3D: true,
      cinematic: false,
    },
    _props,
  );
  const theme = useTheme();
  let mapContainer: HTMLDivElement | undefined;
  let activeStyleUrl: string | undefined;
  let popup: mapboxgl.Popup | undefined;
  let updateTimer: ReturnType<typeof setTimeout> | undefined;
  let routeAnimFrame: number | undefined;
  let cancelFlyThrough: (() => void) | undefined;
  let handlersBound = false;
  const index = createPoiIndex();
  let selectedFeatureId: number | null = null;

  const resolveMapStyle = () =>
    props.followColorMode ? mapStyleForColorMode(theme.isDark()) : props.style;

  const setFeatureSelected = (map: mapboxgl.Map, fid: number | null, selected: boolean) => {
    if (fid == null) return;
    try {
      map.setFeatureState({ source: SOURCE_POIS, id: fid }, { selected });
    } catch {
      /* source may not be ready yet */
    }
  };

  const applySelection = (selectedId?: string) => {
    const map = lifecycle.map();
    if (!map) return;
    const nextId = selectedId ? (index.featureIdByName.get(selectedId) ?? null) : null;
    if (selectedFeatureId === nextId) return;
    setFeatureSelected(map, selectedFeatureId, false);
    selectedFeatureId = nextId;
    setFeatureSelected(map, selectedFeatureId, true);

    if (nextId != null) {
      const entry = index.poiByFeatureId.get(nextId);
      if (entry) {
        const lngLat: [number, number] = [toNum(entry.poi.longitude), toNum(entry.poi.latitude)];
        map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 14), speed: 1.2 });
        popup
          ?.setLngLat(lngLat)
          .setDOMContent(
            buildPopupContent(entry.poi, entry.index, {
              isMobile: mapContainer ? mapContainer.offsetWidth < 768 : true,
              onActivate: props.onActivate,
            }),
          )
          .addTo(map);
      }
    } else {
      popup?.remove();
    }
  };

  const bindHandlers = (map: mapboxgl.Map) => {
    if (handlersBound) return;
    handlersBound = true;

    // Click a cluster -> zoom into it.
    map.on("click", LAYER_CLUSTERS, (e) => {
      const feature = e.features?.[0];
      const clusterId = feature?.properties?.cluster_id;
      const source = map.getSource(SOURCE_POIS) as mapboxgl.GeoJSONSource;
      if (clusterId == null) return;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.easeTo({
          center: (feature!.geometry as Point).coordinates as [number, number],
          zoom: zoom ?? map.getZoom() + 1,
        });
      });
    });

    // Click a point -> select + popup.
    map.on("click", LAYER_POINTS, (e) => {
      const feature = e.features?.[0];
      const fid = feature?.id as number | undefined;
      if (fid == null) return;
      const entry = index.poiByFeatureId.get(fid);
      if (!entry) return;
      props.onSelect?.(entry.poi, entry.index);
      applySelection(entry.poi.name);
    });

    const pointer = (layer: string) => {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    };
    pointer(LAYER_POINTS);
    pointer(LAYER_CLUSTERS);
  };

  const ensureLayers = (map: mapboxgl.Map) => {
    ensurePoiLayers(map);
    ensureSignalLayers(map);
    bindHandlers(map);
  };

  /**
   * Layer visibility.
   *
   * Re-applied after ensureLayers rather than only when the toggle changes:
   * Mapbox Standard can re-emit its style and recreate the layers at their
   * default visibility, which would silently switch a layer the user turned off
   * back on.
   */
  const applyVisibility = (map: mapboxgl.Map) => {
    const set = (id: string, visible: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    };
    for (const id of [LAYER_CLUSTERS, LAYER_CLUSTER_COUNT, LAYER_POINTS, LAYER_POINT_NUMBER]) {
      set(id, props.showStops);
    }
    set(LAYER_ROUTES, props.showRoutes);
    for (const id of [LAYER_SIGNAL_HALO, LAYER_SIGNAL_POINTS]) {
      set(id, props.showAlerts);
    }
  };

  /** Update source data in place — no marker teardown/rebuild churn. */
  const updateData = (pois: POI[], fit = true) => {
    const map = lifecycle.map();
    if (!map) return;
    // Standard style reports isStyleLoaded() === false while imports finish, so
    // we cannot gate purely on it — that gate was eating the markers.
    //
    // But addSource *throws* outright before the style is ready, and the
    // debounced effect below can fire 80ms after the POIs arrive, which beats
    // style.load on a cold load and leaves a blank map. So: proceed once our
    // own source exists (proof the style came up, and isStyleLoaded may still
    // be lying), otherwise wait — onStyleReady calls updateData again the
    // moment the style lands, so nothing is lost by skipping here.
    if (!map.getSource(SOURCE_POIS) && !map.isStyleLoaded()) return;
    ensureLayers(map);
    const source = map.getSource(SOURCE_POIS) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    const { points, routes, valid } = buildPoiData(pois, index);
    source.setData(points);
    (map.getSource(SOURCE_ROUTES) as mapboxgl.GeoJSONSource | undefined)?.setData(routes);
    if (routes.features.length > 0) {
      routeAnimFrame = animateRoutes(map, routeAnimFrame);
    }
    (map.getSource(SOURCE_SIGNALS) as mapboxgl.GeoJSONSource | undefined)?.setData(
      buildSignalData(props.alerts ?? []),
    );
    applyVisibility(map);
    if (fit) fitToData(map, valid, mapContainer);
    // Re-apply selection if the selected POI is still present.
    applySelection(props.selectedId);
  };

  const initialCenter = (): [number, number] => {
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
        return props.center;
      }
    }
    return FALLBACK_CENTER;
  };

  const lifecycle = useMapLifecycle({
    container: () => mapContainer,
    sentinelSourceId: SOURCE_POIS,
    mapOptions: () => {
      const initialStyle = resolveMapStyle();
      activeStyleUrl = initialStyle;
      return {
        style: initialStyle,
        center: initialCenter(),
        zoom: props.zoom || 12,
        minZoom: props.minZoom || 2,
        maxZoom: props.maxZoom || 20,
        pitch: props.pitch ?? (props.enable3D ? 48 : 0),
        bearing: props.enable3D ? -18 : 0,
        // Globe projection for a rounded-earth discovery view; antialias smooths
        // the Standard style's 3D building edges.
        projection: props.enable3D ? "globe" : "mercator",
        antialias: true,
      };
    },
    // Controls and popup exist before any style event fires, matching the order
    // the map was originally built in — a selection arriving on the first
    // style.load must find a popup already there.
    onCreated: (map) => {
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
    },
    applyConfig: (map) => {
      if (props.enable3D) apply3DConfig(map, theme.isDark());
    },
    ensureLayers,
    onStyleReady: (map) => {
      updateData(props.pointsOfInterest, true);
      if (props.cinematic) {
        cancelFlyThrough?.();
        cancelFlyThrough = startItineraryFlyThrough(map, props.pointsOfInterest);
      }
    },
    onReattach: () => updateData(props.pointsOfInterest, false),
  });

  // Swap basemap when color mode changes.
  createEffect(() => {
    if (!props.followColorMode) return;
    const nextStyle = mapStyleForColorMode(theme.isDark());
    const map = lifecycle.map();
    if (!map || activeStyleUrl === nextStyle) return;
    activeStyleUrl = nextStyle;
    map.setStyle(nextStyle);
  });

  // React to POI changes — debounced, in-place source update (no churn).
  createEffect(() => {
    const pois = props.pointsOfInterest;
    if (!lifecycle.map()) return;
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      if (!lifecycle.map()) return;
      updateData(Array.isArray(pois) ? pois : [], true);
    }, 80);
  });

  // React to alert changes — in place, and never refit the camera: a hazard
  // appearing must not yank the view away from what the user was looking at.
  createEffect(() => {
    const alerts = props.alerts;
    const map = lifecycle.map();
    if (!map) return;
    const source = map.getSource(SOURCE_SIGNALS) as mapboxgl.GeoJSONSource | undefined;
    source?.setData(buildSignalData(alerts ?? []));
  });

  // React to layer toggles.
  createEffect(() => {
    // Touch each flag so the effect tracks all three.
    void props.showStops;
    void props.showRoutes;
    void props.showAlerts;
    const map = lifecycle.map();
    if (map) applyVisibility(map);
  });

  // React to external selection (list -> map).
  createEffect(() => {
    const sel = props.selectedId;
    const map = lifecycle.map();
    if (!map || !map.getSource(SOURCE_POIS)) return;
    applySelection(sel);
  });

  onCleanup(() => {
    if (updateTimer) clearTimeout(updateTimer);
    if (routeAnimFrame) cancelAnimationFrame(routeAnimFrame);
    cancelFlyThrough?.();
    popup?.remove();
    // The map instance itself is removed by useMapLifecycle.
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

export type { POI } from "./types";
export default MapComponent;
