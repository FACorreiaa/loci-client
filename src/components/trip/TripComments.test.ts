// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  add: [] as unknown[],
  del: [] as unknown[],
  report: [] as unknown[],
  block: [] as unknown[],
}));
const mutation = (log: unknown[]) => ({
  isPending: false,
  mutate: (vars: unknown, opts?: { onSuccess?: () => void }) => {
    log.push(vars);
    opts?.onSuccess?.();
  },
});
vi.mock("@tanstack/solid-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("~/lib/api/social", () => ({
  initials: (u: { displayName?: string }) => (u.displayName ?? "?").slice(0, 1),
  useBlockUser: () => mutation(calls.block),
}));
vi.mock("~/lib/api/trip-comments", () => ({
  MAX_COMMENT_LENGTH: 2000,
  commentKeys: { forTrip: (id: string) => ["trip-comments", id] },
  commentErrorMessage: () => "error",
  useAddTripComment: () => mutation(calls.add),
  useDeleteTripComment: () => mutation(calls.del),
  useReportTripComment: () => mutation(calls.report),
}));

import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import TripComments from "./TripComments";
import type { TripComment } from "~/lib/api/trip-comments";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
  for (const log of Object.values(calls)) log.length = 0;
});

const comments: TripComment[] = [
  {
    id: "c1",
    tripId: "t1",
    author: { id: "u2", username: "rui", displayName: "Rui" } as any,
    body: "Shall we skip the castle?",
    mine: false,
    canDelete: true,
  },
  {
    id: "c2",
    tripId: "t1",
    stopId: "s1",
    author: { id: "me", username: "me", displayName: "Me" } as any,
    body: "Best at sunset",
    mine: true,
    canDelete: true,
  },
];

const mount = () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () =>
      createComponent(TripComments, {
        tripId: "t1",
        comments,
        stops: [{ id: "s1", name: "Miradouro da Graça" }],
      }),
    host,
  );
  return host;
};
const buttons = (el: Element, label: string) =>
  [...el.querySelectorAll("button")].filter((b) => b.textContent?.trim() === label);

describe("TripComments", () => {
  it("names who wrote what, and what it is about", () => {
    const host = mount();
    const rows = host.querySelectorAll('[data-testid="trip-comment"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Rui");
    expect(rows[1].textContent).toContain("You");
    expect(rows[1].textContent).toContain("on Miradouro da Graça");
  });

  it("only others' comments can be reported or blocked", () => {
    const host = mount();
    const [theirs, mine] = host.querySelectorAll('[data-testid="trip-comment"]');
    expect(buttons(theirs, "Report")).toHaveLength(1);
    expect(buttons(theirs, "Block")).toHaveLength(1);
    expect(buttons(mine, "Report")).toHaveLength(0);
    expect(buttons(mine, "Delete")).toHaveLength(1);
  });

  it("reports with a reason and blocks after a confirm", () => {
    const host = mount();
    const theirs = host.querySelectorAll('[data-testid="trip-comment"]')[0];
    buttons(theirs, "Report")[0].click();
    buttons(theirs, "Spam")[0].click();
    expect(calls.report).toEqual([{ tripId: "t1", commentId: "c1", reason: "spam" }]);

    buttons(theirs, "Cancel")[0]?.click();
    buttons(theirs, "Block")[0].click();
    expect(calls.block).toEqual([]);
    buttons(theirs, "Block")[0].click();
    expect(calls.block).toEqual(["u2"]);
  });

  it("posts about a stop and clears the composer", () => {
    const host = mount();
    const about = host.querySelector(
      '[data-testid="trip-comment-about"]',
    ) as unknown as HTMLSelectElement;
    about.value = "s1";
    about.dispatchEvent(new Event("change", { bubbles: true }));
    const body = host.querySelector(
      '[data-testid="trip-comment-body"]',
    ) as unknown as HTMLTextAreaElement;
    body.value = "  Book ahead  ";
    body.dispatchEvent(new Event("input", { bubbles: true }));
    (host.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    expect(calls.add).toEqual([{ tripId: "t1", body: "Book ahead", stopId: "s1" }]);
    expect(body.value).toBe("");
  });
});
