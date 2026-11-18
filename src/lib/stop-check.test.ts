import { describe, expect, it } from "vitest";
import {
  awaitingChecks,
  describeCheck,
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

// 2026-04-14 is a Tuesday.
const TUESDAY = "2026-04-14T00:00:00.000Z";

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

describe("describeCheck", () => {
  it("never calls a place that was not found fake", () => {
    const line = describeCheck({ status: "not_found", hours: "not_listed" });
    expect(line).toMatchObject({ tone: "unknown", mark: "Couldn't check", detail: "" });
    expect(line.explain).toContain("may still be real");
  });

  it("says checked without claiming hours when none are listed", () => {
    expect(describeCheck(checked())).toMatchObject({
      tone: "ok",
      mark: "Checked",
      detail: "hours not listed",
    });
  });

  it.each<[Partial<StopCheck>, string, "ok" | "attention"]>([
    [{ hours: "unreadable" }, "hours vary", "ok"],
    [{ hours: "listed" }, "set a date to check hours", "ok"],
    [{ hours: "open_that_day" }, "open that day", "ok"],
    [{ hours: "open", opensMinute: 600, closesMinute: 1080 }, "open until 18:00", "ok"],
    [{ hours: "open", opensMinute: 0, closesMinute: 1440 }, "always open", "ok"],
    [{ hours: "open", opensMinute: 1080, closesMinute: 1560 }, "open until 02:00", "ok"],
    [{ hours: "open", opensMinute: 600, closesMinute: 1440 }, "open until midnight", "ok"],
    [{ hours: "shut_that_day" }, "shut Tue", "attention"],
    [{ hours: "opens_later", opensMinute: 600 }, "opens 10:00", "attention"],
    [{ hours: "closes_early", closesMinute: 1020 }, "shuts 17:00", "attention"],
    [{ hours: "shut_by_then", closesMinute: 1020 }, "shut from 17:00", "attention"],
  ])("%j reads %s", (over, detail, tone) => {
    expect(describeCheck(checked(over), TUESDAY)).toMatchObject({ mark: "Checked", detail, tone });
  });

  it("falls back to plain words with no date or time to name", () => {
    expect(describeCheck(checked({ hours: "shut_that_day" })).detail).toBe("shut that day");
    expect(describeCheck(checked({ hours: "opens_later" })).detail).toBe("opens later");
    expect(describeCheck(checked({ hours: "closes_early" })).detail).toBe("shuts early");
    expect(describeCheck(checked({ hours: "shut_by_then" })).detail).toBe("shut by then");
  });

  it("names a public holiday and says when its hours are not known", () => {
    const known = describeCheck(checked({ hours: "shut_that_day", holidayName: "Natal" }), TUESDAY);
    expect(known.detail).toBe("shut Tue · Natal");

    const unknown = describeCheck(
      checked({
        hours: "open",
        closesMinute: 1080,
        holidayName: "Dia da Liberdade",
        holidayHoursUnknown: true,
      }),
    );
    expect(unknown.detail).toBe("open until 18:00 · Dia da Liberdade, hours may differ");
    expect(unknown.explain).toContain("public holiday");
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
