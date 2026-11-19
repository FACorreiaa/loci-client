import { describe, expect, it } from "vitest";
import { describeCheck } from "./stop-check-words";
import type { StopCheck } from "./stop-check";

const checked = (over: Partial<StopCheck> = {}): StopCheck => ({
  status: "checked",
  hours: "not_listed",
  ...over,
});

// 2026-04-14 is a Tuesday.
const TUESDAY = "2026-04-14T00:00:00.000Z";

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
