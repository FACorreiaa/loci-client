import { createEffect, createSignal, onCleanup, type JSX } from "solid-js";
import { prefersReducedMotion, useInView } from "~/lib/hooks/useInView";

/**
 * The Loci mascot as a 2.5D scene: the approved render on a plane, with a
 * separate shadow plane behind it, tilted toward the pointer.
 *
 * 2.5D rather than a model, because there is no model — the mascot is a clay
 * render, and the depth here comes from two flat layers at different z under a
 * narrow-FOV perspective camera. That is enough for the figure to lean and the
 * shadow to slide beneath it, which is the whole effect.
 *
 * Everything about how this loads exists to keep it off the landing page's
 * critical path. `/` is audited at performance >= 0.95 (see lighthouserc.cjs)
 * and a previous decision deliberately kept WebGL off this page. So:
 *
 *   - `three` is imported dynamically, so it is a separate chunk and never
 *     enters the initial bundle.
 *   - The chunk is not even fetched until the section scrolls into view.
 *   - The static webp renders during SSR and stays as the fallback. The canvas
 *     fades in over it, so there is no layout shift and no flash of nothing.
 *   - Reduced-motion, a missing WebGL context, or any failure at all leaves the
 *     static image in place. That is not a degraded state; it is the same
 *     picture, holding still.
 *   - The loop stops when the tab is hidden or the section scrolls away. A
 *     requestAnimationFrame nobody is looking at is just a battery drain.
 */

const MASCOT_SRC = "/images/brand/mascot.webp";
const MASCOT_SRCSET = "/images/brand/mascot-sm.webp 303w, /images/brand/mascot.webp 606w";

/**
 * The rendered width of the figure, which is what the browser needs to pick a
 * source — not the box, because object-contain fits the image's 0.715 aspect
 * inside it. 224px tall gives 160px wide; 288px tall gives 206px.
 *
 * Without this the browser assumes 100vw and downloads the 606w file for a
 * 206px slot, which Lighthouse flags on `/` as 45KB of waste. It is right.
 */
const MASCOT_SIZES = "(min-width: 640px) 206px, 160px";

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    // Some privacy tooling throws here rather than returning null.
    return false;
  }
}

export default function MascotScene(props: { class?: string; alt?: string }): JSX.Element {
  const { ref: inViewRef, inView } = useInView({ rootMargin: "200px 0px", threshold: 0.01 });
  const [live, setLive] = createSignal(false);

  let host: HTMLDivElement | undefined;
  let started = false;
  let disposed = false;
  // Set by run() once the scene exists. Not onCleanup inside run(): that runs
  // after an await, by which point Solid's owner is gone and the registration
  // would be silently dropped.
  let teardown: (() => void) | undefined;

  const attach = (el: HTMLDivElement) => {
    host = el;
    inViewRef(el);
  };

  createEffect(() => {
    if (started || !inView() || !host) return;
    if (prefersReducedMotion() || !webglAvailable()) return;
    started = true;
    void run(host);
  });

  onCleanup(() => {
    disposed = true;
    teardown?.();
  });

  async function run(el: HTMLDivElement) {
    // Statically false on the server, so the Worker build drops the import
    // below and never bundles three. `three` lives behind
    // ~/lib/mascot3d/scene, its only importer.
    if (import.meta.env.SSR) return;
    const { mountPlane } = await import("~/lib/mascot3d/scene");
    if (disposed) return;
    const handle = await mountPlane(el, {
      src: MASCOT_SRC,
      onLive: setLive,
      isDisposed: () => disposed,
    });
    if (!handle) return;
    if (disposed) {
      handle.dispose();
      return;
    }
    teardown = () => handle.dispose();
  }

  return (
    <div ref={attach} class={`relative ${props.class ?? ""}`}>
      <img
        src={MASCOT_SRC}
        srcset={MASCOT_SRCSET}
        sizes={MASCOT_SIZES}
        alt={props.alt ?? "The Loci mascot, a clay figure holding a map"}
        width="606"
        height="848"
        // Below the fold and never the LCP element, so it waits its turn.
        loading="lazy"
        decoding="async"
        class="h-full w-full object-contain transition-opacity duration-500"
        classList={{ "opacity-0": live() }}
      />
    </div>
  );
}
