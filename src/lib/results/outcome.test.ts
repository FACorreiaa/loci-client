import { describe, expect, it } from "vitest";
import type { RecommendationTrace } from "~/lib/api/recommendations";
import { outcomeEvent, resultKey, visibleResults, withoutDismissed } from "./outcome";

const trace: RecommendationTrace = {
  runId: "run-1",
  itemId: "item-1",
  rank: 0,
  algorithmVersion: "v1",
  experimentVariant: "personalized",
  surface: "RECOMMENDATION_SURFACE_CHAT",
  channel: "RECOMMENDATION_CHANNEL_WEB",
};

describe("outcomeEvent", () => {
  it("builds a dismissal for a traced place", () => {
    expect(
      outcomeEvent(
        { id: "poi-1", name: "Miradouro", recommendation_trace: trace },
        "RECOMMENDATION_EVENT_TYPE_DISMISSED",
      ),
    ).toEqual({ eventType: "RECOMMENDATION_EVENT_TYPE_DISMISSED", trace, poiId: "poi-1" });
  });

  it("is undefined without a trace, so nothing is sent the server would reject", () => {
    expect(
      outcomeEvent({ id: "poi-1", name: "Miradouro" }, "RECOMMENDATION_EVENT_TYPE_DISMISSED"),
    ).toBeUndefined();
  });
});

describe("withoutDismissed", () => {
  it("drops dismissed places by id, falling back to name", () => {
    const pois = [
      { id: "a", name: "A" },
      { id: "", name: "B" },
      { id: "c", name: "C" },
    ];
    const dismissed = new Set([resultKey(pois[0]), resultKey(pois[1])]);
    expect(withoutDismissed(pois, dismissed).map((p) => p.name)).toEqual(["C"]);
  });
});

describe("visibleResults", () => {
  it("drops a dismissed place from the list and the extras alike, so cards, pins and the extras' numbering stay in step", () => {
    const list = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ];
    const extras = [
      { id: "x", name: "X" },
      { id: "y", name: "Y" },
    ];
    const view = visibleResults(list, extras, new Set(["b", "y"]));
    expect(view.list.map((p) => p.name)).toEqual(["A", "C"]);
    expect(view.extras.map((p) => p.name)).toEqual(["X"]);
    expect(view.extrasStart).toBe(2);
  });
});
