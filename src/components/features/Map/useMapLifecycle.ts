import { onCleanup, onMount } from "solid-js";
import mapboxgl from "mapbox-gl";

export interface MapLifecycleOptions {
  /** The div the map mounts into. Read once, inside onMount. */
  container: () => HTMLDivElement | undefined;
  /** Everything except `container`, which this hook supplies. */
  mapOptions: () => Omit<mapboxgl.MapOptions, "container">;
  /**
   * (Re)creates sources and layers. MUST be idempotent — it is called on
   * style.load AND every time the styledata guard below detects that Standard
   * dropped our layers.
   */
  ensureLayers: (map: mapboxgl.Map) => void;
  /**
   * A source id that only exists because `ensureLayers` created it. Its absence
   * after a style re-emit is how we detect that Standard wiped our layers.
   * Parameterised so the POI map and the globe can each watch their own.
   */
  sentinelSourceId: string;
  /**
   * Called synchronously the moment the instance exists, before any style
   * event. Controls and popups attach here so they are ready before the first
   * `style.load` can trigger a selection.
   */
  onCreated?: (map: mapboxgl.Map) => void;
  /** Style-level config: atmosphere, light preset, 3D objects. */
  applyConfig?: (map: mapboxgl.Map) => void;
  /** First successful style load: push data and fit the camera. */
  onStyleReady?: (map: mapboxgl.Map) => void;
  /** After a re-attach: re-push data but do NOT move the camera. */
  onReattach?: (map: mapboxgl.Map) => void;
}

/**
 * Owns the Mapbox instance lifecycle.
 *
 * The behaviour that must survive any refactor lives here: Mapbox Standard can
 * finish (or re-emit) its style *after* `load` fires, silently dropping every
 * custom layer added before that point. So we gate setup on `style.load` rather
 * than `load`, and re-run `ensureLayers` whenever the sentinel source has gone
 * missing. Both the POI map and the globe depend on it.
 */
export function useMapLifecycle(o: MapLifecycleOptions): {
  map: () => mapboxgl.Map | undefined;
} {
  let map: mapboxgl.Map | undefined;

  onMount(() => {
    const container = o.container();
    if (!container) return;

    mapboxgl.accessToken = (import.meta as any).env.VITE_MAPBOX_API_KEY;

    map = new mapboxgl.Map({ container, ...o.mapOptions() });
    o.onCreated?.(map);

    // style.load fires once the style (including Standard's imported fragments)
    // is ready — `load` alone is too early on Standard and left layers empty.
    map.on("style.load", () => {
      if (!map) return;
      o.applyConfig?.(map);
      o.ensureLayers(map);
      o.onStyleReady?.(map);
    });

    // If Standard re-emits style data and drops our layers, re-add them and
    // re-push the current data (no auto-fit, to avoid yanking the viewport).
    map.on("styledata", () => {
      if (!map || !map.isStyleLoaded()) return;
      if (!map.getSource(o.sentinelSourceId)) {
        o.ensureLayers(map);
        o.onReattach?.(map);
      }
    });

    const resizeObserver = new ResizeObserver(() => map && map.resize());
    resizeObserver.observe(container);
    onCleanup(() => resizeObserver.disconnect());
  });

  onCleanup(() => {
    if (map) map.remove();
    map = undefined;
  });

  return { map: () => map };
}
