import { describe, expect, it } from "vitest";
import fixtures from "./mascot3d/mascot-motion.fixtures.json";
import {
  MASCOT_MOTION,
  approach,
  blinkScale,
  blinkSeconds,
  blinkWait,
  ease,
  entrance,
  lookToward,
  sampleTrack,
  type Easing,
} from "./mascot-motion";

// The same cases run in loci-ios (lociTests/MascotMotionTests.swift), from a
// byte-identical copy of design/mascot-motion.fixtures.json.

type Case = {
  fn: string;
  args: Record<string, number | string>;
  expect: number | Record<string, number>;
};

function run(c: Case): number | Record<string, number> {
  const a = c.args;
  switch (c.fn) {
    case "ease":
      return ease(a.easing as Easing, a.x as number);
    case "sampleTrack":
      return sampleTrack(
        MASCOT_MOTION.states[a.state as string].tracks[a.track as number],
        a.t as number,
      );
    case "blinkSeconds":
      return blinkSeconds();
    case "blinkScale":
      return blinkScale(a.s as number);
    case "blinkWait":
      return blinkWait(a.r as number);
    case "lookToward":
      return { ...lookToward(a.x as number, a.y as number) };
    case "approach":
      return approach(a.current as number, a.target as number, a.dt as number, a.tau as number);
    case "entrance":
      return entrance(a.s as number);
    default:
      throw new Error(`unknown fixture fn ${c.fn}`);
  }
}

describe("mascot motion matches the shared fixtures", () => {
  const cases = (fixtures as { cases: Case[] }).cases;

  it("has cases for every driver function", () => {
    expect(new Set(cases.map((c) => c.fn))).toEqual(
      new Set([
        "ease",
        "sampleTrack",
        "blinkSeconds",
        "blinkScale",
        "blinkWait",
        "lookToward",
        "approach",
        "entrance",
      ]),
    );
  });

  it.each(cases.map((c) => [`${c.fn} ${JSON.stringify(c.args)}`, c] as const))("%s", (_name, c) => {
    const got = run(c);
    if (typeof c.expect === "number") {
      expect(Math.abs((got as number) - c.expect)).toBeLessThan(1e-6);
    } else {
      for (const [k, v] of Object.entries(c.expect)) {
        expect(Math.abs((got as Record<string, number>)[k] - v), k).toBeLessThan(1e-6);
      }
    }
  });
});
