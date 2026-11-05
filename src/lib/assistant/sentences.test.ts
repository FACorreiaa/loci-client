import { describe, expect, it } from "vitest";
import { SentenceChunker, speakable } from "./sentences";

describe("SentenceChunker", () => {
  it("waits for a sentence to finish", () => {
    const c = new SentenceChunker();
    expect(c.push("Your trip to Lis")).toEqual([]);
    expect(c.push("bon is in May. It")).toEqual(["Your trip to Lisbon is in May."]);
    expect(c.flush()).toEqual(["It"]);
  });

  it("gives back several at once", () => {
    const c = new SentenceChunker();
    expect(c.push("Yes! Two of them? Maybe. ")).toEqual(["Yes!", "Two of them?", "Maybe."]);
    expect(c.flush()).toEqual([]);
  });

  it("does not break on a decimal or an initial", () => {
    const c = new SentenceChunker();
    expect(c.push("It has 3.5 stars and St. George is near. ")).toEqual([
      "It has 3.5 stars and St. George is near.",
    ]);
  });

  it("does not hold a long sentence back for ever", () => {
    const c = new SentenceChunker();
    const pieces = c.push("word ".repeat(80));
    expect(pieces.length).toBeGreaterThan(0);
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(240);
  });
});

describe("speakable", () => {
  it("drops markdown and links but keeps the words", () => {
    expect(speakable("**Belém** is [lovely](https://x.y) see https://a.b/c")).toBe(
      "Belém is lovely see",
    );
  });
});
