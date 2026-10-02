import { describe, expect, it, vi } from "vitest";
vi.mock("../connect-transport", () => ({ transport: {} }));
import { QueryClient } from "@tanstack/solid-query";
import { rememberTrip, tripKeys, type Trip } from "./trips";

const trip = {
  id: "t1",
  title: "Lisbon",
  version: 4n,
  days: [],
  stays: [],
  flights: [],
} as unknown as Trip;

describe("rememberTrip", () => {
  // A plan write or an applied proposal bumps the version: the detail takes
  // the new trip, and the list (whose versions the calendar saves with) must
  // refetch, or its next save is a conflict.
  it("caches the detail and marks the list stale", () => {
    const qc = new QueryClient();
    qc.setQueryData(tripKeys.list(), [{ ...trip, version: 3n }]);
    rememberTrip(qc, trip);
    expect(qc.getQueryData(tripKeys.detail("t1"))).toBe(trip);
    expect(qc.getQueryState(tripKeys.list())?.isInvalidated).toBe(true);
  });
});
