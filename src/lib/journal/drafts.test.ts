import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import { createDiaryDrafts } from "./drafts";

describe("createDiaryDrafts", () => {
  it("keeps what is being typed through a refetch of the day", () =>
    createRoot((dispose) => {
      const drafts = createDiaryDrafts();
      drafts.edit("d2", "Rain all morning, then");
      // The refetch hands over a fresh day with the old server text.
      expect(drafts.text("d2", "")).toBe("Rain all morning, then");
      expect(drafts.text("d1", "Saved before")).toBe("Saved before");
      dispose();
    }));

  it("lets the server text show once it has caught up with the draft", () =>
    createRoot((dispose) => {
      const drafts = createDiaryDrafts();
      drafts.edit("d1", "Pastéis at Belém ");
      drafts.settle("d1", "Pastéis at Belém");
      expect(drafts.text("d1", "Edited elsewhere")).toBe("Edited elsewhere");
      dispose();
    }));

  it("keeps a draft the server has not caught up with", () =>
    createRoot((dispose) => {
      const drafts = createDiaryDrafts();
      drafts.edit("d1", "newer words");
      drafts.settle("d1", "older words");
      expect(drafts.text("d1", "older words")).toBe("newer words");
      dispose();
    }));
});
