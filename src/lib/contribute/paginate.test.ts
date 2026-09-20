import { describe, expect, it } from "vitest";
import {
  clampPage,
  pageCount,
  pageFromParam,
  pageOf,
  pageRange,
  pageSlice,
  TASKS_PER_PAGE,
} from "./paginate";
import { resolveTask, taskFromPlace } from "./task-from-place";
import { CONTRIBUTABLE_FIELDS } from "~/lib/place-facts/vocabulary";

describe("pageCount", () => {
  it("is 1 when the list is empty, so the pager has a defined page", () => {
    expect(pageCount(0)).toBe(1);
  });

  it("fits five places on one page", () => {
    expect(pageCount(TASKS_PER_PAGE)).toBe(1);
  });

  it("opens a second page on the sixth place", () => {
    expect(pageCount(TASKS_PER_PAGE + 1)).toBe(2);
  });
});

describe("clampPage", () => {
  it("pulls a too-small page up to 1", () => {
    expect(clampPage(0, 12)).toBe(1);
    expect(clampPage(-2, 12)).toBe(1);
  });

  it("pulls a too-large page back onto the last page", () => {
    expect(clampPage(9, 12)).toBe(3);
  });

  it("keeps a valid page", () => {
    expect(clampPage(2, 12)).toBe(2);
  });
});

describe("pageSlice", () => {
  const places = ["a", "b", "c", "d", "e", "f", "g"];

  it("returns the first five on page 1", () => {
    expect(pageSlice(places, 1)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("returns the remainder on the last page", () => {
    expect(pageSlice(places, 2)).toEqual(["f", "g"]);
  });

  it("falls back to the last page when asked for a page that no longer exists", () => {
    expect(pageSlice(places, 99)).toEqual(["f", "g"]);
  });
});

describe("pageRange", () => {
  it("reports nothing to show on an empty list", () => {
    expect(pageRange(1, 0)).toEqual({ start: 0, end: 0 });
  });

  it("is 1-indexed inclusive for a full page", () => {
    expect(pageRange(1, 12)).toEqual({ start: 1, end: 5 });
  });

  it("ends on the last item of a short final page", () => {
    expect(pageRange(3, 12)).toEqual({ start: 11, end: 12 });
  });
});

describe("pageOf", () => {
  it("puts the first item on page 1", () => {
    expect(pageOf(0)).toBe(1);
  });

  it("puts the sixth item on page 2", () => {
    expect(pageOf(5)).toBe(2);
  });
});

describe("pageFromParam", () => {
  it("defaults to page 1 when the URL has no page", () => {
    expect(pageFromParam(undefined)).toBe(1);
    expect(pageFromParam("")).toBe(1);
  });

  it("reads a whole number", () => {
    expect(pageFromParam("3")).toBe(3);
  });

  it("uses the first value when the router repeats the param", () => {
    expect(pageFromParam(["2", "9"])).toBe(2);
  });

  it("ignores junk rather than becoming NaN", () => {
    expect(pageFromParam("nope")).toBe(1);
  });
});

describe("taskFromPlace", () => {
  it("opens every field we know how to ask, so a place off the gap list can still be reported", () => {
    expect(taskFromPlace({ id: "poi-1", name: "Café Alentejo" })).toEqual({
      poiId: "poi-1",
      poiName: "Café Alentejo",
      requestedFields: [...CONTRIBUTABLE_FIELDS],
    });
  });
});

describe("resolveTask", () => {
  it("keeps the gap-list fields when the searched place is already queued", () => {
    const queued = {
      poiId: "poi-1",
      poiName: "Café Alentejo",
      requestedFields: ["PLACE_FACT_FIELD_NOISE_LEVEL" as const],
    };
    expect(resolveTask({ id: "poi-1", name: "Café Alentejo" }, [queued])).toBe(queued);
  });

  it("opens every field when the place is not on the gap list", () => {
    expect(resolveTask({ id: "poi-9", name: "Miradouro" }, []).requestedFields).toEqual(
      CONTRIBUTABLE_FIELDS,
    );
  });
});
