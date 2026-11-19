import { describe, expect, it } from "vitest";
import {
  awaitingChecks,
  needsAttention,
  stopCheckFromWire,
  tallyChecks,
  type StopCheck,
  type StopCheckWire,
} from "./stop-check";

const wire = (over: Partial<StopCheckWire>): StopCheckWire => ({
  status: 1,
  hours: 0,
  holidayName: "",
  holidayHoursUnknown: false,
  source: "osm",
  ...over,
});

const checked = (over: Partial<StopCheck> = {}): StopCheck => ({
  status: "checked",
  hours: "not_listed",
  ...over,
});

describe("stopCheckFromWire", () => {
  it("has no check for a stop the server has not looked up", () => {
    expect(stopCheckFromWire(undefined)).toBeUndefined();
    expect(stopCheckFromWire(wire({ status: 0 }))).toBeUndefined();
  });

  it("maps a found place with its hours", () => {
    const c = stopCheckFromWire(
      wire({
        hours: 6,
        opensMinute: 600,
        closesMinute: 1080,
        checkedAt: { seconds: 1776124800n, nanos: 0 },
      }),
    );
    expect(c).toMatchObject({
      status: "checked",
      hours: "opens_later",
      opensMinute: 600,
      closesMinute: 1080,
      source: "osm",
      checkedAt: "2026-04-14T00:00:00.000Z",
    });
  });

  it("carries no hours for a place that was not found", () => {
    expect(stopCheckFromWire(wire({ status: 2, hours: 4 }))).toMatchObject({
      status: "not_found",
      hours: "not_listed",
    });
  });

  it("reads an hours value it does not know as unreadable, never as open", () => {
    expect(stopCheckFromWire(wire({ hours: 99 }))?.hours).toBe("unreadable");
  });
});

describe("tallyChecks", () => {
  it("counts found places, and leaves out stops with no check", () => {
    const stops = [
      { check: checked({ hours: "open" }) },
      { check: checked({ hours: "shut_that_day" }) },
      { check: { status: "not_found", hours: "not_listed" } as StopCheck },
      {},
    ];
    expect(tallyChecks(stops)).toEqual({ checked: 2, total: 3, needAttention: 1 });
  });

  it("is empty for a day nothing was checked on", () => {
    expect(tallyChecks([{}, {}])).toEqual({ checked: 0, total: 0, needAttention: 0 });
  });
});

describe("needsAttention", () => {
  it("is only for a found place whose hours argue with the plan", () => {
    expect(needsAttention(checked({ hours: "opens_later" }))).toBe(true);
    expect(needsAttention(checked({ hours: "open" }))).toBe(false);
    expect(needsAttention({ status: "not_found", hours: "not_listed" })).toBe(false);
    expect(needsAttention(undefined)).toBe(false);
  });
});

describe("awaitingChecks", () => {
  it("is for a plan with places and no answers yet", () => {
    expect(awaitingChecks([{ stops: [{ poiId: "a" }, { poiId: "b" }] }])).toBe(true);
  });

  it("is over once any stop has an answer, found or not", () => {
    const answered = { status: "not_found", hours: "not_listed" } as StopCheck;
    expect(awaitingChecks([{ stops: [{ poiId: "a", check: answered }, { poiId: "b" }] }])).toBe(
      false,
    );
  });

  it("is not for a plan with nothing to check", () => {
    expect(awaitingChecks([{ stops: [{ poiId: "" }, {}] }])).toBe(false);
    expect(awaitingChecks([])).toBe(false);
  });
});
