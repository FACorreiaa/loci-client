import type { JSX } from "solid-js";

/**
 * The moments Loci shows up for. Each has its own pose once the 2026-10 pose
 * set is approved; until a pose exists its state falls back to the standing
 * figure, which is the same character (see public/images/brand/README.md,
 * "Mascot states"). Adding a pose is one line in POSES below.
 */
export type MascotState =
  | "idle"
  | "welcome"
  | "searching"
  | "thinking"
  | "discovering"
  | "navigating"
  | "success"
  | "empty"
  | "error"
  | "offline";

type Pose = { src: string; srcset: string; width: number; height: number };

const STANDING: Pose = {
  src: "/images/brand/mascot.webp",
  srcset: "/images/brand/mascot-sm.webp 303w, /images/brand/mascot.webp 606w",
  width: 606,
  height: 848,
};

const POSES: Partial<Record<MascotState, Pose>> = {};

type MascotProps = {
  state?: MascotState;
  class?: string;
  /** Rendered width in CSS px, so the browser picks the right source. */
  width?: number;
  /** Set when the figure adds nothing a sentence beside it does not already say. */
  decorative?: boolean;
  alt?: string;
  /** A slow two-pixel bob. Off under prefers-reduced-motion. */
  idle?: boolean;
};

export function Mascot(props: MascotProps): JSX.Element {
  const pose = () => POSES[props.state ?? "idle"] ?? STANDING;
  const width = () => props.width ?? 120;
  return (
    <img
      src={pose().src}
      srcset={pose().srcset}
      sizes={`${width()}px`}
      width={width()}
      height={Math.round((width() * pose().height) / pose().width)}
      loading="lazy"
      decoding="async"
      alt={props.decorative ? "" : (props.alt ?? "Loci, the coral explorer")}
      aria-hidden={props.decorative ? "true" : undefined}
      class={props.class}
      classList={{ "mascot-idle": props.idle }}
    />
  );
}
