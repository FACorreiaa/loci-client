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

/** Height of the figure in world units. Only the ratios to it matter. */
const FIGURE_HEIGHT = 3.2;

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
    const THREE = await import("three");
    if (disposed) return;

    let renderer: import("three").WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // A context can still be refused after the probe above said yes.
      return;
    }

    const texture = await new THREE.TextureLoader().loadAsync(MASCOT_SRC).catch(() => null);
    if (!texture || disposed) {
      renderer.dispose();
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    // A narrow field of view keeps the planes near-orthographic, so the mascot
    // reads as artwork rather than as a photograph of a billboard — while still
    // giving the two layers something to parallax against.
    const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100);

    const aspect = texture.image.width / texture.image.height;
    const figureGeo = new THREE.PlaneGeometry(FIGURE_HEIGHT * aspect, FIGURE_HEIGHT);
    const figureMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const figure = new THREE.Mesh(figureGeo, figureMat);

    // The render's own cast shadow was matted out, because it is cream and
    // would halo on a dark surface (see tools/brand/matte-mascot.py). This is
    // its replacement, and it is also what gives the parallax something to move
    // against.
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(50, 59, 66, 0.42)"); // brand ink
      g.addColorStop(0.55, "rgba(50, 59, 66, 0.14)");
      g.addColorStop(1, "rgba(50, 59, 66, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(FIGURE_HEIGHT * aspect * 0.72, FIGURE_HEIGHT * 0.26);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(0, -FIGURE_HEIGHT * 0.48, -0.6);

    const group = new THREE.Group();
    group.add(shadow, figure);
    scene.add(group);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 420ms ease";
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.appendChild(renderer.domElement);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Frame the figure to the element's height whatever its shape, so the
      // mascot never crops when the column narrows.
      camera.position.z = FIGURE_HEIGHT / 2 / Math.tan((camera.fov * Math.PI) / 360) + 0.6;
      camera.updateProjectionMatrix();
    };
    resize();
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(el);

    // Pointer position as -1..1 within the element, eased toward on each frame
    // so a fast flick does not snap.
    let targetX = 0;
    let targetY = 0;
    const onPointer = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      targetX = ((e.clientX - box.left) / box.width) * 2 - 1;
      targetY = ((e.clientY - box.top) / box.height) * 2 - 1;
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };
    el.addEventListener("pointermove", onPointer);
    el.addEventListener("pointerleave", onLeave);

    let raf = 0;
    let running = false;
    const clock = new THREE.Clock();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const t = clock.getElapsedTime();

      // Idle float. The shadow tightens as the figure rises, which is what sells
      // the height — a shadow of constant size reads as a sticker.
      const lift = Math.sin(t * 0.9) * 0.055;
      figure.position.y = lift;
      const tight = 1 - lift * 1.6;
      shadow.scale.set(tight, tight, 1);
      shadowMat.opacity = 0.85 + lift * 1.2;

      // Ease toward the pointer, and tilt rather than translate: rotation is
      // what makes two coplanar layers separate.
      group.rotation.y += (targetX * 0.16 - group.rotation.y) * 0.06;
      group.rotation.x += (targetY * 0.1 - group.rotation.x) * 0.06;
      group.position.x += (targetX * 0.06 - group.position.x) * 0.06;

      renderer.render(scene, camera);
    };

    const play = () => {
      if (running || disposed) return;
      running = true;
      clock.start();
      frame();
    };
    const pause = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    // Only run while it is both on screen and in a foreground tab.
    const visibility = new IntersectionObserver(
      (entries) => (entries.some((e) => e.isIntersecting) ? play() : pause()),
      { threshold: 0.01 },
    );
    visibility.observe(el);
    const onVisibilityChange = () => (document.hidden ? pause() : play());
    document.addEventListener("visibilitychange", onVisibilityChange);

    // A lost context is not rare — switching GPUs on a laptop does it — and
    // without this the canvas goes blank while the fallback image stays hidden
    // behind it, leaving an empty box where the mascot was.
    const onContextLost = (e: Event) => {
      e.preventDefault();
      pause();
      renderer.domElement.style.opacity = "0";
      setLive(false);
    };
    const onContextRestored = () => {
      renderer.domElement.style.opacity = "1";
      setLive(true);
      play();
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

    play();
    renderer.domElement.style.opacity = "1";
    setLive(true);

    teardown = () => {
      pause();
      visibility.disconnect();
      sizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      el.removeEventListener("pointermove", onPointer);
      el.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      figureGeo.dispose();
      figureMat.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      texture.dispose();
      renderer.domElement.remove();
      renderer.dispose();
    };
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
