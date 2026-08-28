import { createEffect, createMemo, createSignal, mergeProps, onCleanup } from "solid-js";
import mapboxgl from "mapbox-gl";
import { useTheme } from "~/contexts/ThemeContext";
import { applyGlobeAtmosphere, clearGlobeAtmosphere, globeFitZoom } from "./atmosphere";
import {
  GLOBE_STYLE,
  IMAGE_PILL,
  LAYER_GLOBE_NODES,
  SOURCE_GLOBE_ARCS,
  SOURCE_GLOBE_NODES,
} from "./constants";
import { greatCircle, type LngLat } from "./geo";
import {
  buildArcData,
  buildNodeData,
  ensureGlobeLayers,
  type GlobePalette,
} from "./layers/globeLayers";
import { ensurePillImage } from "./layers/pillImage";
import { formatLegLabel, useArcPlayhead } from "./useArcPlayhead";
import { useMapLifecycle } from "./useMapLifecycle";

/** A place the traveller has been, ready to plot. */
export interface GlobeNode {
  id: string;
  label: string;
  lngLat: LngLat;
  /** Visit count. Drives node radius and label priority. */
  weight: number;
}

/** A real leg between two placed points. */
export interface GlobeLeg {
  id: string;
  fromName: string;
  toName: string;
  from: LngLat;
  to: LngLat;
  distanceKm: number;
  durationMins?: number;
  mode: string;
}

export interface GlobeComponentProps {
  nodes: GlobeNode[];
  legs: GlobeLeg[];
  /** Leg id to highlight and sweep. Undefined parks the scrubber. */
  selectedLegId?: string;
  onSelectNode?: (node: GlobeNode) => void;
  /** Reports camera centre so the coordinate readout can track it. */
  onMove?: (centre: { lng: number; lat: number }, zoom: number) => void;
  /** Hands the instance back for zoom/projection controls. */
  onReady?: (map: mapboxgl.Map) => void;
  projection?: "globe" | "mercator";
  /** Whole-planet framing. When false, fits to the plotted nodes. */
  fitWorld?: boolean;
}

const darkPalette: GlobePalette = {
  arc: "#c76b4a", // terracotta — the action/map-mark colour
  node: "#a8c09a", // sage
  nodeStroke: "#0b1a14",
  pillFill: "#14251e",
  pillStroke: "#3d5a4a",
  pillText: "#e8efe9",
  marker: "#d4845c",
};

const lightPalette: GlobePalette = {
  arc: "#a85a3a",
  node: "#294d3c",
  nodeStroke: "#ffffff",
  pillFill: "#fbfaf6",
  pillStroke: "#c6c0ac",
  pillText: "#1b2b22",
  marker: "#c76b4a",
};

const GlobeComponent = (_props: GlobeComponentProps) => {
  const props = mergeProps({ projection: "globe" as const, fitWorld: true }, _props);
  const theme = useTheme();
  let container: HTMLDivElement | undefined;
  const [ready, setReady] = createSignal(false);

  const palette = () => (theme.isDark() ? darkPalette : lightPalette);

  // Densify once per leg set, not per frame. greatCircle() is ~50 haversines
  // per leg and the result is what both the line layer and the scrubber read.
  const arcs = createMemo(() =>
    props.legs.map((leg) => ({
      leg,
      points: greatCircle(leg.from, leg.to),
    })),
  );

  const selectedArc = createMemo(() => {
    const id = props.selectedLegId;
    if (!id) return undefined;
    return arcs().find((a) => a.leg.id === id)?.points;
  });

  const selectedLabel = createMemo(() => {
    const id = props.selectedLegId;
    const leg = props.legs.find((l) => l.id === id);
    return leg ? formatLegLabel(leg.mode, leg.distanceKm, leg.durationMins) : "";
  });

  const ensureLayers = (map: mapboxgl.Map) => {
    const p = palette();
    ensurePillImage(map, IMAGE_PILL, p.pillFill, p.pillStroke);
    ensureGlobeLayers(map, p);
  };

  const pushData = (map: mapboxgl.Map, fit: boolean) => {
    const arcSource = map.getSource(SOURCE_GLOBE_ARCS) as mapboxgl.GeoJSONSource | undefined;
    const nodeSource = map.getSource(SOURCE_GLOBE_NODES) as mapboxgl.GeoJSONSource | undefined;
    if (!arcSource || !nodeSource) return;

    arcSource.setData(
      buildArcData(
        arcs().map(({ leg, points }) => ({
          points,
          properties: {
            legId: leg.id,
            fromName: leg.fromName,
            toName: leg.toName,
            distanceKm: leg.distanceKm,
          },
        })),
      ),
    );
    nodeSource.setData(buildNodeData(props.nodes));

    if (fit && !props.fitWorld && props.nodes.length > 0) {
      try {
        const bounds = new mapboxgl.LngLatBounds();
        props.nodes.forEach((n) => bounds.extend(n.lngLat));
        map.fitBounds(bounds, { padding: 80, maxZoom: 6 });
      } catch {
        /* degenerate bounds (single node) — leave the camera alone */
      }
    }
  };

  const lifecycle = useMapLifecycle({
    container: () => container,
    sentinelSourceId: SOURCE_GLOBE_NODES,
    mapOptions: () => ({
      style: GLOBE_STYLE,
      center: [10, 25],
      zoom: container ? globeFitZoom(container) : 1.4,
      minZoom: 0.6,
      maxZoom: 16,
      pitch: 0,
      bearing: 0,
      projection: props.projection,
      antialias: true,
      // Legally required for Mapbox tiles. Not optional.
      attributionControl: true,
    }),
    onCreated: (map) => {
      // The globe is an image of data, not a control surface, so it gets a
      // descriptive role. The page supplies the keyboard-navigable list.
      map.getContainer().setAttribute("aria-label", "Globe showing cities you have visited");
      map.on("move", () => {
        const c = map.getCenter();
        props.onMove?.({ lng: c.lng, lat: c.lat }, map.getZoom());
      });
      map.on("click", LAYER_GLOBE_NODES, (e) => {
        const cityId = e.features?.[0]?.properties?.cityId;
        const node = props.nodes.find((n) => n.id === cityId);
        if (node) props.onSelectNode?.(node);
      });
      map.on("mouseenter", LAYER_GLOBE_NODES, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", LAYER_GLOBE_NODES, () => (map.getCanvas().style.cursor = ""));
      props.onReady?.(map);
    },
    applyConfig: (map) => {
      if (props.projection === "globe") applyGlobeAtmosphere(map, theme.isDark());
      else clearGlobeAtmosphere(map);
    },
    ensureLayers,
    onStyleReady: (map) => {
      pushData(map, true);
      setReady(true);
    },
    // Re-push without touching the camera: a style re-emit must not yank the
    // viewport out from under the user.
    onReattach: (map) => pushData(map, false),
  });

  // Data changes.
  createEffect(() => {
    // Touch both so the effect re-runs when either changes.
    void props.nodes;
    void props.legs;
    const map = lifecycle.map();
    if (!map || !ready()) return;
    pushData(map, false);
  });

  // Projection toggle. The atmosphere must be torn down explicitly — space
  // colour and stars are no-ops in mercator, so leaving them makes the
  // background jump silently.
  createEffect(() => {
    const projection = props.projection;
    const map = lifecycle.map();
    if (!map || !ready()) return;
    map.setProjection(projection);
    if (projection === "globe") {
      applyGlobeAtmosphere(map, theme.isDark());
    } else {
      clearGlobeAtmosphere(map);
      map.setPitch(0);
    }
  });

  // Colour mode. The pill is a raster image, so icon-color cannot tint it —
  // it has to be regenerated and the layers re-pointed at the new palette.
  createEffect(() => {
    const isDark = theme.isDark();
    const map = lifecycle.map();
    if (!map || !ready()) return;
    const p = isDark ? darkPalette : lightPalette;
    ensurePillImage(map, IMAGE_PILL, p.pillFill, p.pillStroke);
    if (props.projection === "globe") applyGlobeAtmosphere(map, isDark);
  });

  useArcPlayhead({
    map: () => (ready() ? lifecycle.map() : undefined),
    arc: selectedArc,
    label: selectedLabel,
    active: () => Boolean(props.selectedLegId),
  });

  onCleanup(() => setReady(false));

  return (
    <div
      ref={container}
      role="img"
      aria-label="Globe showing cities you have visited"
      class="w-full h-full min-h-[320px] overflow-hidden"
    />
  );
};

export default GlobeComponent;
