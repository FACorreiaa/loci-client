import type { LocalAlert } from "~/lib/api/localContext";

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

export interface MapComponentProps {
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
  /**
   * Live alerts for the destination. Only located ones (hazards) are drawn;
   * country-scoped ones like public holidays have no coordinates and belong in
   * the alert list, not on the map.
   */
  alerts?: LocalAlert[];
  /** Draw the alert overlay. Default true. */
  showAlerts?: boolean;
  /** Draw the itinerary stops. Default true. */
  showStops?: boolean;
}
