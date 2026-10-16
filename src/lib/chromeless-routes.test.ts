import { describe, expect, it } from "vitest";
import { hasOwnSocialImage, isChromeless } from "./chromeless-routes";

describe("chromeless routes", () => {
  it("matches whole path segments only", () => {
    expect(isChromeless("/globe")).toBe(true);
    expect(isChromeless("/recap/trip/abc")).toBe(true);
    expect(isChromeless("/r/abc")).toBe(true);
    expect(isChromeless("/recaps")).toBe(false);
    expect(isChromeless("/reviews")).toBe(false);
    expect(isChromeless("/trips/1")).toBe(false);
  });

  it("knows which pages bring their own social image", () => {
    expect(hasOwnSocialImage("/r/abc")).toBe(true);
    expect(hasOwnSocialImage("/recap/trip/abc")).toBe(false);
    expect(hasOwnSocialImage("/")).toBe(false);
  });
});
