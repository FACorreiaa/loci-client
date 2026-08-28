import { For } from "solid-js";

interface MiniMapProps {
  /** Camera centre. */
  lng: number;
  lat: number;
  /** Places to plot, so the locator shows where your world actually is. */
  nodes: { id: string; lngLat: [number, number] }[];
  /** Fly the globe to a clicked point. */
  onJump: (lng: number, lat: number) => void;
}

const W = 180;
const H = 90;

/** Equirectangular, matching the graticule spacing below. */
const project = (lng: number, lat: number) => ({
  x: ((((lng + 180) % 360) + 360) % 360) * (W / 360),
  y: ((90 - lat) / 180) * H,
});

const unproject = (x: number, y: number) => ({
  lng: (x / W) * 360 - 180,
  lat: 90 - (y / H) * 180,
});

/**
 * Picture-in-picture locator.
 *
 * Inline SVG, not a second Mapbox instance: another map would cost a second set
 * of tile requests, a second map-load billing event, a second render loop and a
 * second WebGL context (which iOS Safari caps) — indefensible for a 180x90
 * locator.
 *
 * It plots a graticule plus the traveller's own places rather than a world
 * coastline. Both are real data; a coastline would have meant shipping a
 * simplified geometry blob for pure decoration.
 */
export default function MiniMap(props: MiniMapProps) {
  const camera = () => project(props.lng, props.lat);

  const handle = (e: MouseEvent) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const { lng, lat } = unproject(
      ((e.clientX - rect.left) / rect.width) * W,
      ((e.clientY - rect.top) / rect.height) * H,
    );
    props.onJump(lng, lat);
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="button"
      tabindex="0"
      aria-label="World locator. Click to move the globe."
      class="island-panel cursor-crosshair rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={handle}
      onKeyDown={(e) => {
        // Keyboard equivalent: a clickable thing with no keyboard path fails
        // the a11y ratchet outright.
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onJump(0, 0);
        }
      }}
    >
      <rect width={W} height={H} fill="hsl(var(--muted))" opacity="0.35" />

      {/* Graticule every 30deg lon / 30deg lat. */}
      <g stroke="hsl(var(--border))" stroke-width="0.4" opacity="0.7">
        <For each={[30, 60, 90, 120, 150, 210, 240, 270, 300, 330]}>
          {(deg) => <line x1={deg * (W / 360)} y1={0} x2={deg * (W / 360)} y2={H} />}
        </For>
        <For each={[30, 60, 120, 150]}>
          {(deg) => <line x1={0} y1={deg * (H / 180)} x2={W} y2={deg * (H / 180)} />}
        </For>
      </g>
      {/* Equator and prime meridian, slightly stronger. */}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="hsl(var(--border))" stroke-width="0.7" />
      <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="hsl(var(--border))" stroke-width="0.7" />

      <g fill="hsl(var(--primary))" opacity="0.85">
        <For each={props.nodes}>
          {(n) => {
            const p = project(n.lngLat[0], n.lngLat[1]);
            return <circle cx={p.x} cy={p.y} r="1.3" />;
          }}
        </For>
      </g>

      <circle
        cx={camera().x}
        cy={camera().y}
        r="3.2"
        fill="none"
        stroke="hsl(var(--accent))"
        stroke-width="1.4"
      />
    </svg>
  );
}
