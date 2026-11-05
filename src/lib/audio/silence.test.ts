import { describe, expect, it } from "vitest";
import { createSilenceDetector, rms } from "./silence";

describe("createSilenceDetector", () => {
  it("waits for them to start before listening for the end", () => {
    const d = createSilenceDetector(1000);
    expect(d.feed(0, 0)).toBe(false);
    expect(d.feed(0, 60_000)).toBe(false);
  });

  it("stops after a pause following speech", () => {
    const d = createSilenceDetector(1000);
    expect(d.feed(0.5, 0)).toBe(false);
    expect(d.feed(0, 500)).toBe(false);
    expect(d.feed(0, 1000)).toBe(true);
  });

  it("starts the pause again when they carry on", () => {
    const d = createSilenceDetector(1000);
    d.feed(0.5, 0);
    d.feed(0, 900);
    d.feed(0.5, 950);
    expect(d.feed(0, 1500)).toBe(false);
    expect(d.feed(0, 1950)).toBe(true);
  });
});

describe("rms", () => {
  it("is zero for silence and larger for louder", () => {
    expect(rms(new Uint8Array([128, 128]))).toBe(0);
    expect(rms(new Uint8Array([0, 255]))).toBeGreaterThan(rms(new Uint8Array([120, 136])));
    expect(rms(new Uint8Array())).toBe(0);
  });
});
