import { describe, expect, it } from "vitest";
import {
  hasShareLink,
  sharedTripUrl,
  strangerLinkFor,
  visibilityLabel,
  VISIBILITY_OPTIONS,
} from "./visibility";

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

  it("hands a stranger a link only when it will open for them", () => {
    const url = "https://lociai.fyi/t/abc_12";
    expect(strangerLinkFor({ visibility: "link", shareCode: "abc_12" })).toBe(url);
    expect(strangerLinkFor({ visibility: "public", shareCode: "abc_12" })).toBe(url);

    // Opens for friends alone: not one to put in a message.
    expect(strangerLinkFor({ visibility: "friends", shareCode: "abc_12" })).toBeUndefined();
    // Made private again: the server keeps the code, and it opens for nobody.
    expect(strangerLinkFor({ visibility: "private", shareCode: "abc_12" })).toBeUndefined();
    expect(strangerLinkFor({ shareCode: "abc_12" })).toBeUndefined();
    expect(strangerLinkFor({ visibility: "link" })).toBeUndefined();
    expect(strangerLinkFor({ visibility: "link", shareCode: "" })).toBeUndefined();
    expect(strangerLinkFor(undefined)).toBeUndefined();
  });
});
