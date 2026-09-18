import { describe, expect, it } from "vitest";
import { errorMessage } from "./connect-error";

describe("errorMessage", () => {
  it("strips the Connect code prefix", () => {
    expect(
      errorMessage(
        new Error("[failed_precondition] cannot delete the default travel profile"),
        "fallback",
      ),
    ).toBe("cannot delete the default travel profile");
  });

  it("leaves a message with no prefix alone", () => {
    expect(errorMessage(new Error("something went wrong"), "fallback")).toBe(
      "something went wrong",
    );
  });

  // A thrown non-Error, or an Error whose message is only a prefix, has nothing
  // to show — the caller's fallback is better than an empty toast.
  it("falls back for anything without a usable message", () => {
    expect(errorMessage("a string", "fallback")).toBe("fallback");
    expect(errorMessage(new Error(""), "fallback")).toBe("fallback");
    expect(errorMessage(new Error("[internal] "), "fallback")).toBe("fallback");
  });
});
