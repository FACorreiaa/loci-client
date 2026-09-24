import { describe, expect, it } from "vitest";
import { addStop, moveStop, removeStop, setNights } from "./stop-builder";

describe("stop builder", () => {
  it("adds, dedupes and caps", () => {
    let l = addStop([], "Lisbon");
    l = addStop(l, " lisbon ");
    expect(l).toHaveLength(1);
    expect(l[0]).toEqual({ cityName: "Lisbon", nights: 2 });
    for (const c of ["Porto", "Seville", "Madrid", "Coimbra", "Faro"]) l = addStop(l, c);
    expect(l).toHaveLength(5);
    expect(addStop(l, "   ")).toBe(l);
  });

  it("moves, sets nights within 1..14, removes", () => {
    let l = [{ cityName: "A" }, { cityName: "B" }, { cityName: "C" }];
    l = moveStop(l, 2, 0);
    expect(l.map((s) => s.cityName)).toEqual(["C", "A", "B"]);
    expect(moveStop(l, 0, 9)).toBe(l);
    expect(setNights(l, 0, 0)[0].nights).toBe(1);
    expect(setNights(l, 0, 99)[0].nights).toBe(14);
    expect(removeStop(l, 1).map((s) => s.cityName)).toEqual(["C", "B"]);
  });
});
