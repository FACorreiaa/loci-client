import { describe, expect, it } from "vitest";
import { stripPromptWrapper } from "./prompt-wrapper";

// The server persists the user turn as the prompt it built, not what the user
// typed: "Unified Chat Stream - Domain: itinerary, Message: Itinerary in Funchal."
// Chat history and recents both show that string back to the user unless it is
// unwrapped first.
describe("stripPromptWrapper", () => {
  it("returns the message part of a wrapped prompt", () => {
    expect(
      stripPromptWrapper("Unified Chat Stream - Domain: itinerary, Message: Itinerary in Funchal."),
    ).toBe("Itinerary in Funchal.");
  });

  it("is case-insensitive and tolerant of spacing around the separators", () => {
    expect(
      stripPromptWrapper("unified chat stream - domain:dining,   message:   Best food in Porto  "),
    ).toBe("Best food in Porto");
  });

  it("leaves a plain message unchanged", () => {
    expect(stripPromptWrapper("Best food in Porto")).toBe("Best food in Porto");
  });

  it("keeps a multi-line message intact", () => {
    const wrapped =
      "Unified Chat Stream - Domain: general, Message: Plan a weekend.\nWe like museums.\n\nAnd wine.";
    expect(stripPromptWrapper(wrapped)).toBe("Plan a weekend.\nWe like museums.\n\nAnd wine.");
  });

  it("returns an empty string unchanged", () => {
    expect(stripPromptWrapper("")).toBe("");
  });

  it("does not touch a message that merely mentions the wrapper mid-sentence", () => {
    const s = "Tell me about the Unified Chat Stream - Domain: x, Message: y feature";
    expect(stripPromptWrapper(s)).toBe(s);
  });
});
