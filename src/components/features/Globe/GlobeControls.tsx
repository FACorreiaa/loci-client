import { Box, Layers, Minus, Plus } from "lucide-solid";

interface GlobeControlsProps {
  projection: "globe" | "mercator";
  onProjection: (p: "globe" | "mercator") => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

/**
 * Projection toggle + zoom, in one floating panel.
 *
 * Hand-rolled rather than mapboxgl.NavigationControl: this app never imports
 * `mapbox-gl/dist/mapbox-gl.css`, so Mapbox's built-in controls render
 * completely unstyled.
 *
 * There is no toggle-group primitive in src/ui, so the projection switch is a
 * plain radiogroup — the correct semantics for "pick one of two views".
 */
export default function GlobeControls(props: GlobeControlsProps) {
  const btn =
    "inline-flex h-11 w-11 items-center justify-center rounded-xl text-sm transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
    "disabled:opacity-40 disabled:pointer-events-none";

  const radio = (active: boolean) =>
    `${btn} gap-1.5 w-auto px-3 ${
      active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
    }`;

  return (
    <div class="island-panel flex items-center gap-1 rounded-2xl p-1.5">
      <div role="radiogroup" aria-label="Projection" class="flex items-center gap-1">
        <button
          type="button"
          role="radio"
          aria-checked={props.projection === "globe"}
          class={radio(props.projection === "globe")}
          onClick={() => props.onProjection("globe")}
        >
          <Box class="h-4 w-4" aria-hidden="true" />
          <span class="ui-label text-xs">3D</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={props.projection === "mercator"}
          class={radio(props.projection === "mercator")}
          onClick={() => props.onProjection("mercator")}
        >
          <Layers class="h-4 w-4" aria-hidden="true" />
          <span class="ui-label text-xs">2D</span>
        </button>
      </div>

      <span class="mx-1 h-6 w-px bg-border" aria-hidden="true" />

      <button
        type="button"
        class={`${btn} text-foreground hover:bg-muted`}
        aria-label="Zoom in"
        disabled={!props.canZoomIn}
        onClick={props.onZoomIn}
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class={`${btn} text-foreground hover:bg-muted`}
        aria-label="Zoom out"
        disabled={!props.canZoomOut}
        onClick={props.onZoomOut}
      >
        <Minus class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
