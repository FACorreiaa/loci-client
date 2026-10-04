import { describe, expect, it, vi } from "vitest";

vi.mock("../connect-transport", () => ({ transport: {} }));

import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  AttachmentKind,
  CommentSchema,
  PostSchema,
  SanctionKind,
  SanctionSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/boards/v1/boards_pb.js";
import {
  applyVote,
  attachmentHref,
  boardsErrorMessage,
  buildCommentTree,
  mapComment,
  mapPost,
  mapSanction,
  slugify,
  SLUG_RE,
  type Comment,
} from "./boards";

describe("boards mappers", () => {
  it("maps a post with its attachment and clamps my_vote", () => {
    const p = mapPost(
      create(PostSchema, {
        id: "p1",
        board: { slug: "lisbon", name: "Lisbon" },
        title: "Trams",
        myVote: 1,
        attachment: { kind: AttachmentKind.ITINERARY, ref: "i1", title: "Lisbon in 3 days" },
      }),
    );
    expect(p.board.slug).toBe("lisbon");
    expect(p.myVote).toBe(1);
    expect(p.attachment).toMatchObject({ kind: "itinerary", ref: "i1", title: "Lisbon in 3 days" });
  });

  it("drops an attachment of an unknown kind", () => {
    const p = mapPost(
      create(PostSchema, { id: "p1", attachment: { kind: AttachmentKind.UNSPECIFIED } }),
    );
    expect(p.attachment).toBeUndefined();
  });

  it("strips author and body from a deleted comment", () => {
    const c = mapComment(
      create(CommentSchema, {
        id: "c1",
        deleted: true,
        body: "gone",
        author: { id: "u", username: "x" },
      }),
    );
    expect(c.author).toBeUndefined();
    expect(c.body).toBe("");
  });

  it("maps sanction kinds", () => {
    expect(mapSanction(create(SanctionSchema, { kind: SanctionKind.BAN })).kind).toBe("ban");
    expect(mapSanction(create(SanctionSchema, { kind: SanctionKind.MUTE })).kind).toBe("mute");
  });
});

const comment = (id: string, parentId = ""): Comment => ({
  id,
  postId: "p",
  parentId,
  body: id,
  deleted: false,
  createdAt: "",
});

describe("buildCommentTree", () => {
  it("nests replies under their parents in order", () => {
    const tree = buildCommentTree([
      comment("a"),
      comment("b"),
      comment("a1", "a"),
      comment("a1x", "a1"),
    ]);
    expect(tree.map((n) => n.comment.id)).toEqual(["a", "b"]);
    expect(tree[0].children[0].comment.id).toBe("a1");
    expect(tree[0].children[0].children[0].comment.id).toBe("a1x");
  });

  it("surfaces orphans at the top level", () => {
    const tree = buildCommentTree([comment("x", "missing")]);
    expect(tree.map((n) => n.comment.id)).toEqual(["x"]);
  });
});

describe("applyVote", () => {
  it("votes, flips and clears", () => {
    expect(applyVote({ score: 0, myVote: 0 }, 1)).toEqual({ score: 1, myVote: 1 });
    expect(applyVote({ score: 1, myVote: 1 }, -1)).toEqual({ score: -1, myVote: -1 });
    expect(applyVote({ score: -1, myVote: -1 }, -1)).toEqual({ score: 0, myVote: 0 });
  });
});

describe("helpers", () => {
  it("slugifies board names into valid addresses", () => {
    expect(slugify("Trip reports!")).toBe("trip-reports");
    expect(slugify("  São Paulo  eats ")).toBe("sao-paulo-eats");
    expect(SLUG_RE.test(slugify("Lisbon"))).toBe(true);
    expect(slugify("x".repeat(40)).length).toBe(32);
  });

  it("links only places that every viewer can open", () => {
    const base = { ref: "id", title: "", subtitle: "", imageUrl: "", city: "" };
    expect(attachmentHref({ ...base, kind: "poi" })).toBe("/places/id");
    expect(attachmentHref({ ...base, kind: "itinerary" })).toBeUndefined();
  });

  it("explains failed writes", () => {
    expect(boardsErrorMessage(new ConnectError("x", Code.ResourceExhausted))).toMatch(/Slow down/);
    expect(
      boardsErrorMessage(new ConnectError("you are muted from boards", Code.PermissionDenied)),
    ).toBe("you are muted from boards");
    expect(boardsErrorMessage(new Error("boom"))).toMatch(/Something went wrong/);
  });
});
