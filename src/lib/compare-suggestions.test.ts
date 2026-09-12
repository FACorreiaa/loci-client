import { describe, it, expect } from "vitest";
import { ConnectError, Code } from "@connectrpc/connect";
import { citySuggestionsFrom, CITY_SUGGESTIONS_HEADER } from "./compare-suggestions";

function errorWithSuggestions(payload: unknown): ConnectError {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const binary = String.fromCharCode(...bytes);
  const base64url = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const metadata = new Headers();
  metadata.set(CITY_SUGGESTIONS_HEADER, base64url);
  return new ConnectError("compare: no such city", Code.InvalidArgument, metadata);
}

describe("citySuggestionsFrom", () => {
  it("decodes the suggestions the server attached", () => {
    const err = errorWithSuggestions([
      { name: "Évora", country: "Portugal", country_code: "PT", lat: 38.5714, lon: -7.9135 },
    ]);

    const got = citySuggestionsFrom(err);
    expect(got).toHaveLength(1);
    // Accents have to survive: they are the reason the payload is base64 at all,
    // and a latin-1 decode would render this as mojibake in the UI.
    expect(got[0].name).toBe("Évora");
    expect(got[0].lat).toBeCloseTo(38.5714);
    expect(got[0].lon).toBeCloseTo(-7.9135);
    // The payload is Go-encoded and therefore snake_case; reading countryCode
    // straight off it would silently always be undefined.
    expect(got[0].countryCode).toBe("PT");
  });

  it("keeps every suggestion in order", () => {
    const got = citySuggestionsFrom(
      errorWithSuggestions([
        { name: "Porto", country: "Portugal", lat: 41.1, lon: -8.6 },
        { name: "Porto", country: "Brazil", lat: -11.4, lon: -37.2 },
      ]),
    );
    expect(got.map((s) => s.country)).toEqual(["Portugal", "Brazil"]);
  });

  // Everything below runs while rendering an error state. A throw here would
  // replace a useful message with a blank page, so each of these must degrade.
  it("returns nothing for an error with no suggestions", () => {
    expect(citySuggestionsFrom(new ConnectError("boom", Code.Unavailable))).toEqual([]);
  });

  it("returns nothing for malformed base64", () => {
    const metadata = new Headers();
    metadata.set(CITY_SUGGESTIONS_HEADER, "!!!not base64!!!");
    expect(citySuggestionsFrom(new ConnectError("x", Code.InvalidArgument, metadata))).toEqual([]);
  });

  it("returns nothing when the payload is not an array", () => {
    expect(citySuggestionsFrom(errorWithSuggestions({ name: "Évora" }))).toEqual([]);
  });

  it("drops entries that are not usable suggestions", () => {
    const got = citySuggestionsFrom(
      errorWithSuggestions([
        { name: "Évora", country: "Portugal", lat: 38.5, lon: -7.9 },
        { country: "Portugal", lat: 1, lon: 2 },
        { name: "No coordinates", country: "Portugal" },
        null,
        "Beja",
      ]),
    );
    expect(got).toHaveLength(1);
    expect(got[0].name).toBe("Évora");
  });

  it("returns nothing for a plain error, a string, or nothing at all", () => {
    expect(citySuggestionsFrom(new Error("network"))).toEqual([]);
    expect(citySuggestionsFrom("failed")).toEqual([]);
    expect(citySuggestionsFrom(undefined)).toEqual([]);
    expect(citySuggestionsFrom(null)).toEqual([]);
  });
});
