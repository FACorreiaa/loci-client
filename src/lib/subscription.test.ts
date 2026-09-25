import { describe, expect, it } from "vitest";

import { PLAN_GATING_ENABLED, canUsePro, isProPlan } from "./subscription";

// Plan gating is off until the product has users to gate (server: PLAN_GATING,
// docs/pricing.md). The plan itself stays truthful for the badge and billing.
describe("canUsePro", () => {
  it("is off by default and opens every feature to every plan", () => {
    expect(PLAN_GATING_ENABLED).toBe(false);
    expect(canUsePro("free")).toBe(true);
    expect(canUsePro(undefined)).toBe(true);
    expect(canUsePro("premium_monthly")).toBe(true);
  });

  it("would follow the plan with gating on", () => {
    expect(canUsePro("free", true)).toBe(false);
    expect(canUsePro("premium_annual", true)).toBe(true);
  });

  it("never changes what the plan is", () => {
    expect(isProPlan("free")).toBe(false);
    expect(isProPlan("premium_monthly")).toBe(true);
  });
});
