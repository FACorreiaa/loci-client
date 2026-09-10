import { describe, expect, it } from "vitest";
import { readsAsProse } from "~/lib/stream-error-prose";

describe("readsAsProse", () => {
  it("passes a server sentence through", () => {
    expect(
      readsAsProse(
        "Unable to find places near your location. Please try again or expand your search radius.",
      ),
    ).toBe(true);
    expect(readsAsProse("Location data is required for nearby searches.")).toBe(true);
  });

  it("rejects transport noise", () => {
    expect(readsAsProse("[connect] rpc error: code = Unavailable desc = x")).toBe(false);
    expect(readsAsProse("Error: fetch failed")).toBe(false);
    expect(readsAsProse("TypeError: Cannot read properties of undefined (reading 'x')")).toBe(
      false,
    );
    expect(readsAsProse('{"error":"boom"}')).toBe(false);
    expect(readsAsProse("at d (StreamErrorCard-jhGF4_z4.js:1:940)")).toBe(false);
  });

  it("rejects fragments and walls of text", () => {
    expect(readsAsProse("nope")).toBe(false);
    expect(readsAsProse("lowercase start.")).toBe(false);
    expect(readsAsProse("No trailing punctuation")).toBe(false);
    expect(readsAsProse("A".repeat(300) + ".")).toBe(false);
  });
});
