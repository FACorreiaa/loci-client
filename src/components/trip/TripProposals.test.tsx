// @vitest-environment happy-dom
//
// A card from the planner on a trip nobody else is on: no votes to cast, and
// the owner turns it down, they do not "take it back".

import { render } from "solid-js/web";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import TripProposals from "./TripProposals";
import type { TripProposal } from "~/lib/api/trip-proposals";

const OWNER = "owner-1";

const proposal = (over: Partial<TripProposal> = {}): TripProposal =>
  ({
    id: "p1",
    summary:
      "Museu Nacional do Azulejo is shut on Mon 13 Apr. Move it to day 2 (Tue 14 Apr), when it is open 10:00–18:00.",
    source: "chat",
    status: "pending",
    proposer: { id: OWNER, displayName: "Ana" },
    upVotes: 0,
    downVotes: 0,
    myReaction: 0,
    needsPick: false,
    ...over,
  }) as TripProposal;

let host: HTMLDivElement;
let dispose: () => void;

const mount = (p: TripProposal, reactions?: boolean) => {
  dispose = render(
    () => (
      <QueryClientProvider client={new QueryClient()}>
        <TripProposals
          tripId="t1"
          proposals={[p]}
          isOwner
          mayApply
          reactions={reactions}
          currentUserId={OWNER}
          baseVersion={3n}
          onConflict={() => {}}
        />
      </QueryClientProvider>
    ),
    host,
  );
};

const labels = () => [...host.querySelectorAll("button")].map((b) => b.textContent?.trim());
const votes = () => host.querySelectorAll('button[aria-label^="Thumbs"]').length;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});
afterEach(() => {
  dispose?.();
  host.remove();
});

describe("TripProposals", () => {
  it("offers a planner's card on a solo trip to apply or turn down, with no votes", () => {
    mount(proposal(), false);
    expect(host.textContent).toContain("From the trip planner");
    expect(host.textContent).toContain("is shut on Mon 13 Apr");
    expect(votes()).toBe(0);
    expect(labels()).toEqual(["Apply", "Not now"]);
  });

  it("keeps the votes on a trip planned together", () => {
    mount(proposal());
    expect(votes()).toBe(2);
  });

  it("still lets someone take back a suggestion they made by hand", () => {
    mount(proposal({ source: "editor" }));
    expect(labels()).toContain("Take back");
  });
});
