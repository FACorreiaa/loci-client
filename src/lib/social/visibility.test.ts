import { describe, expect, it } from "vitest";
import { hasShareLink, sharedTripUrl, visibilityLabel, VISIBILITY_OPTIONS } from "./visibility";

describe("trip visibility", () => {
  it("offers the four levels in order of reach", () => {
    expect(VISIBILITY_OPTIONS.map((o) => o.value)).toEqual([
      "private",
      "friends",
      "link",
      "public",
    ]);
  });

  it("labels an unset visibility as private", () => {
    expect(visibilityLabel(undefined)).toBe("Only me");
    expect(visibilityLabel("link")).toBe("Anyone with the link");
  });

  it("has a link for every level but private", () => {
    expect(hasShareLink(undefined)).toBe(false);
    expect(hasShareLink("private")).toBe(false);
    expect(hasShareLink("friends")).toBe(true);
    expect(hasShareLink("public")).toBe(true);
  });

  it("builds the /t/ url, escaping the code", () => {
    expect(sharedTripUrl("abc_12")).toBe("https://lociai.fyi/t/abc_12");
    expect(sharedTripUrl("a/b")).toBe("https://lociai.fyi/t/a%2Fb");
  });
});
