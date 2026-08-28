import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { greatCircle, type LngLat } from "~/components/features/Map/geo";
import { prefersReducedMotion } from "~/lib/hooks/useInView";

/**
 * Marketing globe for the public landing page.
 *
 * Pure SVG with an orthographic projection — deliberately NOT Mapbox. The `/`
 * route is audited by Lighthouse at performance >= 0.95 as a hard error, and
 * the map chunk is ~1.9 MB raw (520 KB gzipped). This renders in about 4 KB of
 * markup with no WebGL context, so it physically cannot regress that budget.
 *
 * The orthographic visibility test doubles as back-face culling, so arcs and
 * cities on the far side of the globe disappear correctly for free.
 */

const R = 140;
const CX = 160;
const CY = 160;
const RAD = Math.PI / 180;

/** Example routes. Illustrative of the product, not a claim about any user. */
const CITIES: { name: string; lngLat: LngLat }[] = [
  { name: "Lisbon", lngLat: [-9.1393, 38.7223] },
  { name: "Porto", lngLat: [-8.6291, 41.1579] },
  { name: "Marrakesh", lngLat: [-7.9811, 31.6295] },
  { name: "Reykjavík", lngLat: [-21.8277, 64.1265] },
  { name: "Istanbul", lngLat: [28.9784, 41.0082] },
  { name: "Cape Town", lngLat: [18.4241, -33.9249] },
  { name: "New York", lngLat: [-74.006, 40.7128] },
];

const ROUTES: [number, number][] = [
  [0, 2],
  [1, 3],
  [0, 4],
  [6, 0],
  [4, 5],
];

interface Projected {
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Orthographic projection about (lon0, lat0).
 *
 * `visible` is the cosine of the angular distance from the projection centre:
 * positive means the point is on the near hemisphere. That single test is the
 * occlusion model.
 */
const project = (lng: number, lat: number, lon0: number, lat0: number): Projected => {
  const phi = lat * RAD;
  const lam = (lng - lon0) * RAD;
  const phi0 = lat0 * RAD;

  const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
  return {
    x: CX + R * Math.cos(phi) * Math.sin(lam),
    y: CY - R * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam)),
    visible: cosC > 0,
  };
};

/** Splits a densified arc into the runs that are on the near hemisphere. */
const visibleRuns = (points: LngLat[], lon0: number, lat0: number): string[] => {
  const runs: string[] = [];
  let current: string[] = [];

  for (const [lng, lat] of points) {
    const p = project(lng, lat, lon0, lat0);
    if (p.visible) {
      current.push(`${current.length === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    } else if (current.length > 1) {
      runs.push(current.join(" "));
      current = [];
    } else {
      current = [];
    }
  }
  if (current.length > 1) runs.push(current.join(" "));
  return runs;
};

export default function SvgGlobe() {
  const [lon0, setLon0] = createSignal(-20);
  const lat0 = 18;

  onMount(() => {
    // No rotation under reduced motion. Static is a complete state here, not a
    // degraded one — every city and arc is still drawn.
    if (prefersReducedMotion()) return;

    let frame: number;
    let last = performance.now();
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      if (document.visibilityState === "hidden") {
        last = now;
        return;
      }
      const dt = now - last;
      if (dt < 33) return; // ~30fps is plenty for a 6 deg/s drift
      last = now;
      setLon0((v) => (v + (dt / 1000) * 6) % 360);
    };
    frame = requestAnimationFrame(step);
    onCleanup(() => cancelAnimationFrame(frame));
  });

  // Densified once; only the projection changes as the globe turns.
  const arcs = createMemo(() =>
    ROUTES.map(([a, b]) => greatCircle(CITIES[a].lngLat, CITIES[b].lngLat)),
  );

  const projectedCities = createMemo(() =>
    CITIES.map((c) => ({ ...c, p: project(c.lngLat[0], c.lngLat[1], lon0(), lat0) })),
  );

  const meridians = createMemo(() => {
    const out: string[] = [];
    for (let lng = -180; lng < 180; lng += 30) {
      const pts: LngLat[] = [];
      for (let lat = -80; lat <= 80; lat += 5) pts.push([lng, lat]);
      out.push(...visibleRuns(pts, lon0(), lat0));
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: LngLat[] = [];
      for (let lng = -180; lng <= 180; lng += 5) pts.push([lng, lat]);
      out.push(...visibleRuns(pts, lon0(), lat0));
    }
    return out;
  });

  return (
    <svg
      viewBox="0 0 320 320"
      class="h-full w-full max-w-[min(80vw,32rem)]"
      role="img"
      aria-label="A slowly turning globe with example travel routes drawn between cities"
    >
      <defs>
        <radialGradient id="loci-globe-face" cx="35%" cy="30%">
          <stop offset="0%" stop-color="hsl(var(--primary) / 0.30)" />
          <stop offset="100%" stop-color="hsl(var(--primary) / 0.08)" />
        </radialGradient>
        <radialGradient id="loci-globe-rim" cx="50%" cy="50%">
          <stop offset="82%" stop-color="hsl(var(--primary) / 0)" />
          <stop offset="100%" stop-color="hsl(var(--primary) / 0.35)" />
        </radialGradient>
      </defs>

      {/* Atmosphere, then the sphere itself. */}
      <circle cx={CX} cy={CY} r={R + 14} fill="url(#loci-globe-rim)" />
      <circle cx={CX} cy={CY} r={R} fill="url(#loci-globe-face)" />
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke="hsl(var(--primary) / 0.35)"
        stroke-width="1"
      />

      <g stroke="hsl(var(--primary) / 0.18)" stroke-width="0.6" fill="none">
        <For each={meridians()}>{(d) => <path d={d} />}</For>
      </g>

      <g stroke="hsl(var(--accent))" stroke-width="1.4" fill="none" stroke-linecap="round">
        <For each={arcs()}>
          {(arc) => (
            <For each={visibleRuns(arc, lon0(), lat0)}>{(d) => <path d={d} opacity="0.85" />}</For>
          )}
        </For>
      </g>

      <g>
        <For each={projectedCities()}>
          {(c) => (
            <Show when={c.p.visible}>
              <circle cx={c.p.x} cy={c.p.y} r="2.6" fill="hsl(var(--accent))" />
            </Show>
          )}
        </For>
      </g>
    </svg>
  );
}
