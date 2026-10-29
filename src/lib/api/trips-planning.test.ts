import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/connect-transport", () => ({ transport: {} }));

import { mayApplySuggestions } from "./trips";

const someone = { id: "u1", username: "ana", displayName: "Ana" } as never;

describe("mayApplySuggestions", () => {
  it("lets the owner apply", () => {
    expect(mayApplySuggestions({ owner: undefined, viewerRole: "owner" })).toBe(true);
  });

  it("lets a co-planner apply only when the owner allows it", () => {
    expect(mayApplySuggestions({ owner: someone, viewerRole: "co_planner" })).toBe(false);
    expect(
      mayApplySuggestions({ owner: someone, viewerRole: "co_planner", coPlannersMayApply: true }),
    ).toBe(true);
  });

  it("never lets a viewer apply", () => {
    expect(
      mayApplySuggestions({ owner: someone, viewerRole: "viewer", coPlannersMayApply: true }),
    ).toBe(false);
  });
});
