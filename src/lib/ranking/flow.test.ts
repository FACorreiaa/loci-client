import { describe, expect, it } from "vitest";
import { afterAnswer, comparePrompt, doneMessage, groupByCity, type RankedPlaceView } from "./flow";

const place = (over: Partial<RankedPlaceView>): RankedPlaceView => ({
  poiId: "p",
  name: "Place",
  category: "",
  cityName: "Lisbon",
  verdict: "loved",
  rank: 1,
  score: 10,
  pending: false,
  ...over,
});

describe("how-was-it flow", () => {
  it("asks the next comparison while there is one", () => {
    const state = afterAnswer(place({ pending: true }), { poiId: "x", name: "Manteigaria" });
    expect(state).toEqual({
      step: "compare",
      place: place({ pending: true }),
      other: { poiId: "x", name: "Manteigaria" },
    });
    expect(comparePrompt("Manteigaria")).toBe("Better or worse than Manteigaria?");
  });

  it("finishes when the server sends no comparison", () => {
    const done = afterAnswer(place({ rank: 2 }), undefined);
    expect(done).toEqual({ step: "done", place: place({ rank: 2 }) });
    expect(doneMessage(place({ rank: 2, cityName: "Lisbon" }))).toBe("#2 in your Lisbon list");
  });
});

describe("groupByCity", () => {
  it("keeps server order, caps each city at 10, and leads with the biggest list", () => {
    const lisbon = Array.from({ length: 12 }, (_, i) => place({ poiId: `l${i}`, rank: i + 1 }));
    const porto = [place({ poiId: "p0", cityName: "Porto" })];
    const groups = groupByCity([...porto, ...lisbon]);
    expect(groups.map((g) => g.city)).toEqual(["Lisbon", "Porto"]);
    expect(groups[0].places).toHaveLength(10);
    expect(groups[0].places[0].poiId).toBe("l0");
    expect(groups[0].total).toBe(12);
  });
});
