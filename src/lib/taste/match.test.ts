import { describe, expect, it } from "vitest";
import { fromProtoTasteMatch, matchLabel, matchPercent, showOnCard } from "./match";

describe("taste match", () => {
  it("is a rounded percent, and absent when the server sent none", () => {
    expect(matchPercent({ score: 0.874, reasons: [] })).toBe(87);
    expect(matchPercent(undefined)).toBeUndefined();
    expect(matchLabel({ score: 0.874, reasons: [] })).toBe("87% match");
  });

  it("shows on cards only from 60%", () => {
    expect(showOnCard({ score: 0.6, reasons: [] })).toBe(true);
    expect(showOnCard({ score: 0.59, reasons: [] })).toBe(false);
    expect(showOnCard(undefined)).toBe(false);
  });

  it("maps the proto message, dropping blank reasons", () => {
    expect(fromProtoTasteMatch({ score: 0.7, reasons: ["You tend to like cafe", " "] })).toEqual({
      score: 0.7,
      reasons: ["You tend to like cafe"],
    });
    expect(fromProtoTasteMatch(undefined)).toBeUndefined();
  });
});
