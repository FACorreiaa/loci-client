import { createSignal } from "solid-js";

/**
 * Diary text being typed, kept by day id outside the day's component. A
 * refetch hands the page fresh day objects and remounts every day, which
 * would otherwise reset a half-written note to the server's text.
 */
export function createDiaryDrafts() {
  const [drafts, setDrafts] = createSignal<Record<string, string>>({});

  const drop = (dayId: string) =>
    setDrafts((all) => {
      const { [dayId]: _, ...rest } = all;
      return rest;
    });

  return {
    /** What the day's note box shows: the draft, else the server's text. */
    text: (dayId: string, server: string) => drafts()[dayId] ?? server,
    edit: (dayId: string, text: string) => setDrafts((all) => ({ ...all, [dayId]: text })),
    /** After a save: drop the draft once the server has the same words. */
    settle: (dayId: string, server: string) => {
      const draft = drafts()[dayId];
      if (draft !== undefined && draft.trim() === server.trim()) drop(dayId);
    },
  };
}

export type DiaryDrafts = ReturnType<typeof createDiaryDrafts>;
