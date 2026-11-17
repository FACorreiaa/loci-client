import { describe, expect, it } from "vitest";
import fixtures from "./mascot3d/mascot-motion.fixtures.json";
import {
  MASCOT_MOTION,
  approach,
  blinkScale,
  blinkSeconds,
  blinkWait,
  ease,
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
    default:
      throw new Error(`unknown fixture fn ${c.fn}`);
  }
}

// One shape for both kinds of result: a bare number is compared as { value }.
const asRecord = (v: number | Record<string, number>): Record<string, number> =>
  typeof v === "number" ? { value: v } : v;

describe("mascot motion matches the shared fixtures", () => {
  const cases = (fixtures as unknown as { cases: Case[] }).cases;

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
      ]),
    );
  });

  it.each(cases.map((c) => [`${c.fn} ${JSON.stringify(c.args)}`, c] as const))("%s", (_name, c) => {
    // A missing key or a number where a record was expected subtracts to NaN,
    // which fails the comparison.
    const got = asRecord(run(c));
    for (const [k, v] of Object.entries(asRecord(c.expect))) {
      expect(Math.abs(got[k] - v), k).toBeLessThan(1e-6);
    }
  });
});
