import { createEffect, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { prefersReducedMotion, useInView } from "~/lib/hooks/useInView";

/**
 * The 3D Loci mascot (BRD-001, beta only). See docs/MASCOT_3D.md.
 *
 * The first paint is a still rendered from the same model, camera and lights
 * at the rest pose (tools/brand/mascot-still.mjs), so when the canvas takes
 * over after its first drawn frame it replaces an identical picture.
 *
 * The still stays, and nothing WebGL is fetched, when: this is the server,
 * the model URL is empty, the reader prefers reduced motion, Save-Data is on,
 * there is no WebGL, the slot is narrower than `minWidth`, the model fails to
 * load, or the context is lost. That is not a degraded state; it is the same
 * picture, holding still.
 */

/**
 * The model URL. Empty means off: set only by the beta deployment
 * (.github/workflows/deploy-beta.yml). Vite inlines it, so in production the
 * import below is dead code and no 3D chunk is emitted for it.
 */
export const MASCOT_3D_URL: string = import.meta.env.VITE_MASCOT_3D_URL ?? "";

const STILL_SRC = "/images/brand/mascot-3d-still.webp";
const STILL_SRCSET =
  "/images/brand/mascot-3d-still-sm.webp 360w, /images/brand/mascot-3d-still.webp 720w";

function savesData(): boolean {
  return (
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  );
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    // Some privacy tooling throws here rather than returning null.
    return false;
  }
}

export default function Mascot3D(props: {
  /** Sizing classes; the box keeps the still's 3:4 shape. */
  class?: string;
  alt?: string;
  /** Rendered width of the still, for srcset selection. */
  sizes: string;
  /** Only start at or above this viewport width (px), e.g. where an aside shows. */
  minWidth?: number;
}): JSX.Element {
  const { ref: inViewRef, inView } = useInView({ rootMargin: "200px 0px", threshold: 0.01 });
  const [live, setLive] = createSignal(false);

  let host: HTMLDivElement | undefined;
  let started = false;
  let disposed = false;
  // Set once the scene exists. Not onCleanup inside run(): that runs after an
  // await, when Solid's owner is gone, and the registration would be dropped.
  let teardown: (() => void) | undefined;

  const attach = (el: HTMLDivElement) => {
    host = el;
    inViewRef(el);
  };

  const allowed = () =>
    !import.meta.env.SSR &&
    MASCOT_3D_URL !== "" &&
    !prefersReducedMotion() &&
    !savesData() &&
    (props.minWidth === undefined ||
      window.matchMedia(`(min-width: ${props.minWidth}px)`).matches) &&
    webglAvailable();

  onMount(() => {
    createEffect(() => {
      if (started || !inView() || !host || !allowed()) return;
      started = true;
      void run(host);
    });
  });

  onCleanup(() => {
    disposed = true;
    teardown?.();
  });

  async function run(el: HTMLDivElement) {
    if (import.meta.env.SSR || MASCOT_3D_URL === "") return;
    let handle: import("~/lib/mascot3d/scene").MascotHandle;
    try {
      const { mountModel } = await import("~/lib/mascot3d/scene");
      if (disposed) return;
      handle = await mountModel({
        host: el,
        url: MASCOT_3D_URL,
        onFirstFrame: () => setLive(true),
        onLost: () => setLive(false),
      });
    } catch {
      // Chunk, model or context failure: the still stays.
      setLive(false);
      return;
    }
    if (disposed) {
      handle.dispose();
      return;
    }

    // Follow the pointer anywhere on the page, measured from the mascot's
    // centre and scaled by the viewport so the turn stays small.
    const onPointer = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const reach = Math.max(window.innerWidth, window.innerHeight) / 2;
      handle.setPointer(
        (e.clientX - (box.left + box.width / 2)) / reach,
        -(e.clientY - (box.top + box.height / 2)) / reach,
      );
    };
    const onLeave = () => handle.setPointer(0, 0);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    // Run only while on screen and in a foreground tab.
    let onScreen = false;
    const sync = () => handle.setRunning(onScreen && !document.hidden);
    const visibility = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        sync();
      },
      { threshold: 0.01 },
    );
    visibility.observe(el);
    document.addEventListener("visibilitychange", sync);

    teardown = () => {
      visibility.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      handle.dispose();
    };
  }

  return (
    <div
      ref={attach}
      class={`mascot-3d relative aspect-[3/4] ${props.class ?? ""}`}
      classList={{ "mascot-3d--live": live() }}
    >
      <img
        src={STILL_SRC}
        srcset={STILL_SRCSET}
        sizes={props.sizes}
        alt={props.alt ?? "The Loci mascot, a coral figure in white trainers with a small backpack"}
        width="720"
        height="960"
        loading="lazy"
        decoding="async"
        class="mascot-3d__still h-full w-full object-contain"
      />
    </div>
  );
}
