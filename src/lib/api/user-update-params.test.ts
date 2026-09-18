import { describe, expect, it } from "vitest";
import { buildUpdateProfileParams } from "./user";

/**
 * UpdateProfileParams carries `min_len: 1` on every optional text field, and
 * the server runs protovalidate (cmd/api/router.go, validate.NewInterceptor).
 *
 * Sending "" therefore does not clear a field — it fails validation for the
 * entire request. This shipped once: the settings page sent an empty phone
 * number along with everything else, and every profile save returned 400 for
 * any account that had not filled in a phone, city and country.
 */
describe("buildUpdateProfileParams", () => {
  it("omits empty strings rather than sending them", () => {
    const out = buildUpdateProfileParams({
      username: "someone",
      aboutYou: "a bio",
      phoneNumber: "",
      city: "",
      country: "",
    });

    expect(out.aboutYou).toBe("a bio");
    expect(out).not.toHaveProperty("phoneNumber");
    expect(out).not.toHaveProperty("city");
    expect(out).not.toHaveProperty("country");
  });

  it("omits fields the request did not mention", () => {
    const out = buildUpdateProfileParams({ aboutYou: "just the bio" });

    expect(Object.keys(out)).toEqual(["aboutYou"]);
  });

  it("keeps values that are present and non-empty", () => {
    const out = buildUpdateProfileParams({
      firstname: "Ada",
      lastname: "Lovelace",
      phoneNumber: "+351912345678",
      city: "Lisbon",
    });

    expect(out).toMatchObject({
      firstname: "Ada",
      lastname: "Lovelace",
      phoneNumber: "+351912345678",
      city: "Lisbon",
    });
  });

  // Locale fields are constrained enumerations backed by CHECK constraints,
  // so "" is never a value to send for them either.
  it("omits empty locale fields", () => {
    const out = buildUpdateProfileParams({ timezone: "", units: "", currency: "" });

    expect(out).toEqual({});
  });
});
