import { createSignal, createEffect, onCleanup, Show, on } from "solid-js";
import { ImageOff } from "lucide-solid";
import { cn } from "@/cn";

/**
 * ProgressiveImage — the image-loading strategy in one component.
 *
 *  • Lazy: nothing is fetched until the frame scrolls near the viewport
 *    (IntersectionObserver, 300px rootMargin). Decode is off the main
 *    list-render path.
 *  • LQIP placeholder: a deterministic colored gradient (hue derived
 *    from `seed`) shows instantly — stable per-card, no layout shift.
 *  • Blur-up: the real image is preloaded, then fades + un-scales over
 *    the placeholder once decoded.
 *  • Enrichment-aware: while `src` is undefined (stop not yet enriched)
 *    it shimmers; the moment `src` arrives it loads — no remount.
 *  • Error state: broken/missing image falls back to an icon tile.
 */
export interface ProgressiveImageProps {
  src?: string;
  alt: string;
  seed?: string;
  class?: string;
  /** skip lazy gate (e.g. above-the-fold hero) */
  eager?: boolean;
}

const hueFromSeed = (seed = "") => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
};

export default function ProgressiveImage(props: ProgressiveImageProps) {
  const [inView, setInView] = createSignal(Boolean(props.eager));
  const [status, setStatus] = createSignal<"idle" | "loading" | "loaded" | "error">("idle");
  const [resolvedSrc, setResolvedSrc] = createSignal<string>();
  let frame: HTMLDivElement | undefined;

  // Lazy gate.
  createEffect(() => {
    if (props.eager || inView() || !frame) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(frame);
    onCleanup(() => io.disconnect());
  });

  // Preload + decode whenever a src is available and we're in view.
  createEffect(
    on([() => props.src, inView], ([src, visible]) => {
      if (!src || !visible) return;
      if (resolvedSrc() === src && status() === "loaded") return;
      setStatus("loading");
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      const finish = (ok: boolean) => {
        if (ok) {
          setResolvedSrc(src);
          setStatus("loaded");
        } else {
          setStatus("error");
        }
      };
      img
        .decode?.()
        .then(() => finish(true))
        .catch(() => {
          // decode() can reject on some hosts even when usable — fall back to events
          img.addEventListener("load", () => finish(true));
          img.addEventListener("error", () => finish(false));
        });
    }),
  );

  return (
    <div
      ref={frame}
      class={cn("pi-frame", props.class)}
      style={{ "--pi-hue": String(hueFromSeed(props.seed || props.alt)) }}
    >
      {/* LQIP — always present underneath until a real image paints */}
      <Show when={status() !== "loaded"}>
        <div class={cn("pi-lqip", (status() === "idle" || status() === "loading") && "shimmer")} />
      </Show>

      <Show when={status() === "error"}>
        <div class="pi-error">
          <ImageOff class="w-6 h-6 opacity-60" />
        </div>
      </Show>

      <Show when={resolvedSrc()}>
        <img
          class="pi-img"
          src={resolvedSrc()}
          alt={props.alt}
          loading="lazy"
          decoding="async"
          data-loaded={status() === "loaded"}
        />
      </Show>
    </div>
  );
}
