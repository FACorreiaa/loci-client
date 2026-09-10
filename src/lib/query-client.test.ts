import { describe, expect, it } from "vitest";
import { Code, ConnectError } from "@connectrpc/connect";
import { APIError } from "./api";
import { shouldRetryMutation, shouldRetryQuery } from "./query-client";

const finalCodes = [
  Code.Unauthenticated,
  Code.PermissionDenied,
  Code.InvalidArgument,
  Code.NotFound,
  Code.Unimplemented,
  Code.FailedPrecondition,
];

describe("shouldRetryQuery", () => {
  it("never retries a ConnectError whose code cannot change on retry", () => {
    for (const code of finalCodes) {
      expect(shouldRetryQuery(0, new ConnectError("nope", code))).toBe(false);
    }
  });

  it("still retries transient ConnectErrors up to three times", () => {
    const err = new ConnectError("try later", Code.Unavailable);
    expect(shouldRetryQuery(0, err)).toBe(true);
    expect(shouldRetryQuery(2, err)).toBe(true);
    expect(shouldRetryQuery(3, err)).toBe(false);
  });

  it("keeps the APIError behaviour: 401/403 are final, the rest retry", () => {
    expect(shouldRetryQuery(0, new APIError("unauthorized", 401))).toBe(false);
    expect(shouldRetryQuery(0, new APIError("forbidden", 403))).toBe(false);
    expect(shouldRetryQuery(0, new APIError("boom", 500))).toBe(true);
  });

  it("retries unknown errors up to three times", () => {
    expect(shouldRetryQuery(0, new TypeError("fetch failed"))).toBe(true);
    expect(shouldRetryQuery(3, new TypeError("fetch failed"))).toBe(false);
  });
});

describe("shouldRetryMutation", () => {
  it("never retries a ConnectError whose code cannot change on retry", () => {
    for (const code of finalCodes) {
      expect(shouldRetryMutation(0, new ConnectError("nope", code))).toBe(false);
    }
  });

  it("retries a transient ConnectError exactly once", () => {
    const err = new ConnectError("try later", Code.Unavailable);
    expect(shouldRetryMutation(0, err)).toBe(true);
    expect(shouldRetryMutation(1, err)).toBe(false);
  });

  it("keeps the APIError behaviour: any 4xx is final", () => {
    expect(shouldRetryMutation(0, new APIError("bad", 422))).toBe(false);
    expect(shouldRetryMutation(0, new APIError("boom", 503))).toBe(true);
  });
});
