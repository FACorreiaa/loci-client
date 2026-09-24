import { describe, expect, it } from "vitest";
import { PURCHASE_POLL_MAX, PURCHASE_POLL_MS, purchasePollInterval } from "./purchase-poll";

const detail = (owned: boolean, lockedDayCount: number) => ({ pack: { owned }, lockedDayCount });

describe("purchasePollInterval", () => {
  it("never polls without a purchase return", () => {
    expect(purchasePollInterval(false, detail(false, 2), 0)).toBe(false);
  });

  it("polls while a just-bought pack still reads locked", () => {
    expect(purchasePollInterval(true, detail(false, 2), 1)).toBe(PURCHASE_POLL_MS);
  });

  it("stops once the pack is owned or nothing is locked", () => {
    expect(purchasePollInterval(true, detail(true, 2), 1)).toBe(false);
    expect(purchasePollInterval(true, detail(false, 0), 1)).toBe(false);
  });

  it("waits for the first response before polling", () => {
    expect(purchasePollInterval(true, undefined, 0)).toBe(false);
  });

  it("gives up after the cap so a failed webhook does not poll forever", () => {
    expect(purchasePollInterval(true, detail(false, 2), PURCHASE_POLL_MAX)).toBe(false);
  });
});
