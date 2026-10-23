import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/api", () => ({ chatService: {} }));
vi.mock("~/lib/connect-transport", () => ({ transport: {} }));
vi.mock("../connect-transport", () => ({ transport: {} }));
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  ActionProposalSchema,
  ProposalSource,
  ProposalStatus,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { applyErrorMessage, mapProposal } from "./trip-proposals";

describe("mapProposal", () => {
  it("maps a co-planner's suggestion with its reactions", () => {
    const p = mapProposal(
      create(ActionProposalSchema, {
        id: "p1",
        tripId: "t1",
        summary: "Swap Miradouro da Graça for Santa Luzia on day 1.",
        action: { kind: { case: "replaceStop", value: { stopId: "s1" } } },
        proposer: { id: "u2", username: "ana", displayName: "Ana" },
        source: ProposalSource.EDITOR,
        status: ProposalStatus.PENDING,
        upVotes: 2,
        downVotes: 1,
        myReaction: -1,
      }),
    );
    expect(p).toMatchObject({
      kind: "replaceStop",
      source: "editor",
      status: "pending",
      upVotes: 2,
      downVotes: 1,
      myReaction: -1,
      needsPick: false,
    });
    expect(p.proposer?.displayName).toBe("Ana");
  });

  it("treats the planner's hotel card as needing a pick", () => {
    const p = mapProposal(
      create(ActionProposalSchema, {
        id: "p2",
        action: { kind: { case: "searchHotels", value: { cityName: "Lisbon" } } },
        status: ProposalStatus.APPLIED,
      }),
    );
    expect(p.source).toBe("chat");
    expect(p.status).toBe("applied");
    expect(p.needsPick).toBe(true);
    expect(p.myReaction).toBe(0);
  });
});

describe("applyErrorMessage", () => {
  it("tells a stale trip from a gone stop", () => {
    expect(
      applyErrorMessage(new ConnectError("trip version conflict", Code.FailedPrecondition)),
    ).toMatch(/just changed/);
    expect(
      applyErrorMessage(
        new ConnectError("trip action was already applied", Code.FailedPrecondition),
      ),
    ).toMatch(/already applied/);
    expect(applyErrorMessage(new ConnectError("stop not found", Code.InvalidArgument))).toMatch(
      /no longer on the trip/,
    );
    expect(applyErrorMessage(new ConnectError("nope", Code.PermissionDenied))).toMatch(/planner/);
  });
});
