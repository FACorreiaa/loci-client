/**
 * Reads the "did you mean" cities the server attaches to an unresolvable-city
 * error.
 *
 * They travel in error metadata rather than in the response because this is a
 * failure: a typed response carrying an error would mean answering 200 with an
 * error-shaped body. They are base64url-encoded because Connect metadata values
 * are ASCII and city names such as "Évora" are not.
 */
import { ConnectError } from "@connectrpc/connect";

export const CITY_SUGGESTIONS_HEADER = "x-loci-city-suggestions";

export interface CitySuggestion {
  name: string;
  country: string;
  countryCode?: string;
  lat: number;
  lon: number;
}

/**
 * Returns the suggestions on an error, or an empty list.
 *
 * Never throws. This runs while rendering an error state, and a malformed
 * header turning into a second, worse failure would replace a useful message
 * with a blank page.
 */
export function citySuggestionsFrom(error: unknown): CitySuggestion[] {
  if (!error) return [];

  let raw: string | undefined;
  try {
    raw = ConnectError.from(error).metadata?.get(CITY_SUGGESTIONS_HEADER) ?? undefined;
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSuggestion).map(toSuggestion);
  } catch {
    return [];
  }
}

/**
 * The payload is Go-encoded, so its keys are snake_case. Reading `countryCode`
 * straight off it would silently always be undefined.
 */
function toSuggestion(value: RawSuggestion): CitySuggestion {
  return {
    name: value.name,
    country: typeof value.country === "string" ? value.country : "",
    countryCode: typeof value.country_code === "string" ? value.country_code : undefined,
    lat: value.lat,
    lon: value.lon,
  };
}

interface RawSuggestion {
  name: string;
  country?: unknown;
  country_code?: unknown;
  lat: number;
  lon: number;
}

function isSuggestion(value: unknown): value is RawSuggestion {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    v.name.length > 0 &&
    typeof v.lat === "number" &&
    typeof v.lon === "number"
  );
}

/**
 * Decodes base64url. `atob` only understands standard base64, and the server
 * uses the URL-safe alphabet without padding, so both have to be restored.
 */
function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  // Decode as UTF-8 so accented city names survive; atob alone yields latin-1
  // and would render "Évora" as mojibake.
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
