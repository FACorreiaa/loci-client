/**
 * The 3D mascot's motion driver (BRD-001): time in, values out.
 *
 * Pure and renderer-free on purpose. Nothing here imports three, so the
 * numbers can be tested without WebGL, and so the iOS driver
 * (loci-ios `Core/Theme/MascotMotion.swift`) can be held to the same answers:
 * both test suites iterate `design/mascot-motion.fixtures.json`.
 *
 * Every value is an offset from the rest pose in `mascot-rig.json`. Lengths are
 * in mascot heights (the model is one unit tall). Rotation order is YXZ — yaw,
 * then pitch, then roll — on both platforms.
 */

import motionData from "./mascot3d/mascot-motion.json";

export type Easing = "sine" | "linear";
export type TrackProperty =
  | "translateY"
  | "rotateXDegrees"
  | "rotateYDegrees"
  | "rotateZDegrees"
  | "scale"
  | "scaleY"
  | "emissiveScale";

export interface Keyframe {
  t: number;
  v: number;
}

export interface Track {
  joint?: string;
  material?: string;
  property: TrackProperty;
  periodSeconds: number;
  easing: Easing;
  keyframes: Keyframe[];
}

export interface MascotMotion {
  version: number;
  states: Record<string, { kind: "loop"; tracks: Track[] }>;
  blink: {
    joints: string[];
    property: "scaleY";
    open: number;
    shut: number;
    intervalSeconds: [number, number];
    closeSeconds: number;
    holdSeconds: number;
    openSeconds: number;
  };
  lookAt: {
    joint: string;
    eyes: string[];
    bodyYawDegrees: number;
    bodyPitchDegrees: number;
    eyeOffset: number;
    timeConstantSeconds: number;
  };
}

export const MASCOT_MOTION = motionData as unknown as MascotMotion;

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

export function ease(easing: Easing, x: number): number {
  const u = clamp(x);
  return easing === "linear" ? u : (1 - Math.cos(Math.PI * u)) / 2;
}

/** A looping track's value at `t` seconds. Negative time wraps too. */
export function sampleTrack(track: Track, t: number): number {
  const kf = track.keyframes;
  let phase = t / track.periodSeconds;
  phase -= Math.floor(phase);
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i];
    const b = kf[i + 1];
    if (a.t <= phase && phase <= b.t) {
      const u = b.t > a.t ? (phase - a.t) / (b.t - a.t) : 0;
      return a.v + (b.v - a.v) * ease(track.easing, u);
    }
  }
  return kf[kf.length - 1].v;
}

export function blinkSeconds(m: MascotMotion = MASCOT_MOTION): number {
  const b = m.blink;
  return b.closeSeconds + b.holdSeconds + b.openSeconds;
}

/** The eyes' scaleY `s` seconds into a blink; open outside it. */
export function blinkScale(s: number, m: MascotMotion = MASCOT_MOTION): number {
  const b = m.blink;
  if (s < 0 || s >= blinkSeconds(m)) return b.open;
  if (s < b.closeSeconds) return b.open + (b.shut - b.open) * ease("sine", s / b.closeSeconds);
  if (s < b.closeSeconds + b.holdSeconds) return b.shut;
  const u = (s - b.closeSeconds - b.holdSeconds) / b.openSeconds;
  return b.shut + (b.open - b.shut) * ease("sine", u);
}

/** Seconds until the next blink, from a uniform random `r` in [0, 1]. */
export function blinkWait(r: number, m: MascotMotion = MASCOT_MOTION): number {
  const [lo, hi] = m.blink.intervalSeconds;
  return lo + (hi - lo) * clamp(r);
}

export interface Look {
  yawDegrees: number;
  /** Positive looks up. */
  pitchDegrees: number;
  eyeX: number;
  eyeY: number;
}

/** Where the mascot wants to look for a pointer at x, y in [-1, 1] (y up). */
export function lookToward(x: number, y: number, m: MascotMotion = MASCOT_MOTION): Look {
  const l = m.lookAt;
  const cx = clamp(x, -1, 1);
  const cy = clamp(y, -1, 1);
  return {
    yawDegrees: cx * l.bodyYawDegrees,
    pitchDegrees: cy * l.bodyPitchDegrees,
    eyeX: cx * l.eyeOffset,
    eyeY: cy * l.eyeOffset,
  };
}

/** Exponential approach with time constant `tau`; `tau <= 0` snaps. */
export function approach(current: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}
