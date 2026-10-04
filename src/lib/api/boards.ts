// Community boards — BoardsService. Topic boards anyone signed in may open,
// posts (a title, an optional link, an optional body, an optional Loci item),
// threaded comments and up/down votes on posts. Reads work signed out; the
// server is the only gate on writes and on the admin actions.
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/solid-query";
import { createClient, ConnectError, Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate, type Timestamp } from "@bufbuild/protobuf/wkt";
import {
  AttachmentKind,
  BoardsService,
  PostSort,
  SanctionKind,
  TopWindow,
  CreateBoardRequestSchema,
  CreateCommentRequestSchema,
  CreatePostRequestSchema,
  DeleteBoardRequestSchema,
  DeleteCommentRequestSchema,
  DeletePostRequestSchema,
  GetBoardRequestSchema,
  GetBoardsViewerRequestSchema,
  GetPostRequestSchema,
  LiftSanctionRequestSchema,
  ListBoardsRequestSchema,
  ListPostsRequestSchema,
  ListSanctionsRequestSchema,
  SanctionUserRequestSchema,
  VotePostRequestSchema,
  type Board as ProtoBoard,
  type Comment as ProtoComment,
  type Post as ProtoPost,
  type Sanction as ProtoSanction,
} from "@buf/loci_loci-proto.bufbuild_es/loci/boards/v1/boards_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import { mapPublicUser, type PublicUser } from "./social";

const client = createClient(BoardsService, transport);

export interface Board {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdBy?: PublicUser;
  createdAt: string;
  postCount: number;
  lastActivityAt: string;
}

export type AttachmentKindName = "itinerary" | "poi" | "city";

export interface Attachment {
  kind: AttachmentKindName;
  ref: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  city: string;
}

export type Vote = -1 | 0 | 1;

export interface Post {
  id: string;
  board: { slug: string; name: string };
  author?: PublicUser;
  title: string;
  url: string;
  domain: string;
  body: string;
  attachment?: Attachment;
  score: number;
  commentCount: number;
  myVote: Vote;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string;
  author?: PublicUser;
  body: string;
  deleted: boolean;
  createdAt: string;
}

export type SanctionKindName = "mute" | "ban";

export interface Sanction {
  id: string;
  user?: PublicUser;
  kind: SanctionKindName;
  reason: string;
  expiresAt: string;
  createdAt: string;
  liftedAt: string;
}

export interface BoardsViewer {
  signedIn: boolean;
  isAdmin: boolean;
  sanction?: Sanction;
}

export type PostSortName = "new" | "top";
export type TopWindowName = "day" | "week" | "all";

// ---- mappers (pure, tested) ----

const iso = (t?: Timestamp) => (t ? timestampDate(t).toISOString() : "");

const KIND_NAMES: Record<number, AttachmentKindName> = {
  [AttachmentKind.ITINERARY]: "itinerary",
  [AttachmentKind.POI]: "poi",
  [AttachmentKind.CITY]: "city",
};

const KIND_VALUES: Record<AttachmentKindName, AttachmentKind> = {
  itinerary: AttachmentKind.ITINERARY,
  poi: AttachmentKind.POI,
  city: AttachmentKind.CITY,
};

export const mapBoard = (b: ProtoBoard): Board => ({
  id: b.id,
  slug: b.slug,
  name: b.name,
  description: b.description,
  createdBy: mapPublicUser(b.createdBy),
  createdAt: iso(b.createdAt),
  postCount: b.postCount,
  lastActivityAt: iso(b.lastActivityAt),
});

const clampVote = (v: number): Vote => (v > 0 ? 1 : v < 0 ? -1 : 0);

export const mapPost = (p: ProtoPost): Post => {
  const kind = p.attachment ? KIND_NAMES[p.attachment.kind] : undefined;
  return {
    id: p.id,
    board: { slug: p.board?.slug ?? "", name: p.board?.name ?? "" },
    author: mapPublicUser(p.author),
    title: p.title,
    url: p.url,
    domain: p.domain,
    body: p.body,
    attachment:
      p.attachment && kind
        ? {
            kind,
            ref: p.attachment.ref,
            title: p.attachment.title,
            subtitle: p.attachment.subtitle,
            imageUrl: p.attachment.imageUrl,
            city: p.attachment.city,
          }
        : undefined,
    score: p.score,
    commentCount: p.commentCount,
    myVote: clampVote(p.myVote),
    createdAt: iso(p.createdAt),
  };
};

export const mapComment = (c: ProtoComment): Comment => ({
  id: c.id,
  postId: c.postId,
  parentId: c.parentId,
  author: c.deleted ? undefined : mapPublicUser(c.author),
  body: c.deleted ? "" : c.body,
  deleted: c.deleted,
  createdAt: iso(c.createdAt),
});

export const mapSanction = (s: ProtoSanction): Sanction => ({
  id: s.id,
  user: mapPublicUser(s.user),
  kind: s.kind === SanctionKind.BAN ? "ban" : "mute",
  reason: s.reason,
  expiresAt: iso(s.expiresAt),
  createdAt: iso(s.createdAt),
  liftedAt: iso(s.liftedAt),
});

export interface CommentNode {
  comment: Comment;
  children: CommentNode[];
}

/**
 * Nests the flat comment list the server returns. Replies whose parent is
 * missing (pruned server side) surface at the top level rather than vanish.
 */
export const buildCommentTree = (comments: Comment[]): CommentNode[] => {
  const nodes = new Map(comments.map((c) => [c.id, { comment: c, children: [] as CommentNode[] }]));
  const roots: CommentNode[] = [];
  for (const c of comments) {
    const node = nodes.get(c.id)!;
    const parent = c.parentId ? nodes.get(c.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
};

/**
 * What the score and the caller's vote become when the caller presses an arrow:
 * pressing the arrow already lit clears the vote.
 */
export const applyVote = (
  current: { score: number; myVote: Vote },
  pressed: 1 | -1,
): { score: number; myVote: Vote } => {
  const next: Vote = current.myVote === pressed ? 0 : pressed;
  return { score: current.score - current.myVote + next, myVote: next };
};

/** Where an attached item opens, when the viewer can open it at all. */
export const attachmentHref = (a: Attachment): string | undefined =>
  a.kind === "poi" ? `/places/${encodeURIComponent(a.ref)}` : undefined;

/** A board address from a name: "Trip reports!" → "trip-reports". */
export const slugify = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");

export const SLUG_RE = /^[a-z0-9-]{3,32}$/;

/** A message for a failed board write that a person can act on. */
export const boardsErrorMessage = (err: unknown): string => {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.Unauthenticated:
        return "Sign in to do that.";
      case Code.ResourceExhausted:
        return "Slow down — you've done that a lot recently. Try again in a bit.";
      case Code.AlreadyExists:
        return "A board with that address already exists.";
      case Code.PermissionDenied:
      case Code.InvalidArgument:
      case Code.NotFound:
        return err.rawMessage || "That didn't work.";
    }
  }
  return "Something went wrong. Try again.";
};

// ---- query keys ----

export const boardsKeys = {
  all: ["boards"] as const,
  list: () => ["boards", "list"] as const,
  board: (slug: string) => ["boards", "board", slug] as const,
  posts: (slug: string, sort: PostSortName, window: TopWindowName) =>
    ["boards", "posts", slug, sort, sort === "top" ? window : ""] as const,
  post: (id: string) => ["boards", "post", id] as const,
  viewer: () => ["boards", "viewer"] as const,
  sanctions: () => ["boards", "sanctions"] as const,
};

// ---- queries ----

export const useBoards = () =>
  useAppQuery(() => ({
    queryKey: boardsKeys.list(),
    queryFn: async (): Promise<Board[]> => {
      const res = await client.listBoards(create(ListBoardsRequestSchema, { pageSize: 100 }));
      return res.boards.map(mapBoard);
    },
  }));

export const useBoard = (slug: () => string) =>
  useAppQuery(() => ({
    queryKey: boardsKeys.board(slug()),
    enabled: !!slug(),
    retry: false,
    queryFn: async (): Promise<Board | undefined> => {
      const res = await client.getBoard(create(GetBoardRequestSchema, { slug: slug() }));
      return res.board ? mapBoard(res.board) : undefined;
    },
  }));

export interface PostsPage {
  posts: Post[];
  nextCursor: string;
}

export const fetchPosts = async (
  slug: string,
  sort: PostSortName,
  window: TopWindowName,
  cursor = "",
): Promise<PostsPage> => {
  const res = await client.listPosts(
    create(ListPostsRequestSchema, {
      boardSlug: slug,
      sort: sort === "top" ? PostSort.TOP : PostSort.NEW,
      window: window === "day" ? TopWindow.DAY : window === "all" ? TopWindow.ALL : TopWindow.WEEK,
      cursor,
      pageSize: 30,
    }),
  );
  return { posts: res.posts.map(mapPost), nextCursor: res.nextCursor };
};

/** The first page of a feed; "Load more" appends further pages locally. */
export const usePosts = (
  slug: () => string,
  sort: () => PostSortName,
  window: () => TopWindowName,
) =>
  useAppQuery(() => ({
    queryKey: boardsKeys.posts(slug(), sort(), window()),
    queryFn: () => fetchPosts(slug(), sort(), window()),
  }));

export const usePost = (id: () => string) =>
  useAppQuery(() => ({
    queryKey: boardsKeys.post(id()),
    enabled: !!id(),
    retry: false,
    queryFn: async (): Promise<{ post?: Post; comments: Comment[] }> => {
      const res = await client.getPost(create(GetPostRequestSchema, { id: id() }));
      return {
        post: res.post ? mapPost(res.post) : undefined,
        comments: res.comments.map(mapComment),
      };
    },
  }));

/** Who is looking: admin controls and any sanction. Cheap; refetched on focus. */
export const useBoardsViewer = () =>
  useAppQuery(() => ({
    queryKey: boardsKeys.viewer(),
    staleTime: 60_000,
    queryFn: async (): Promise<BoardsViewer> => {
      const res = await client.getBoardsViewer(create(GetBoardsViewerRequestSchema, {}));
      return {
        signedIn: res.signedIn,
        isAdmin: res.isAdmin,
        sanction: res.activeSanction ? mapSanction(res.activeSanction) : undefined,
      };
    },
  }));

export const useSanctions = (enabled: () => boolean) =>
  useAppQuery(() => ({
    queryKey: boardsKeys.sanctions(),
    enabled: enabled(),
    queryFn: async (): Promise<Sanction[]> => {
      const res = await client.listSanctions(
        create(ListSanctionsRequestSchema, { activeOnly: false }),
      );
      return res.sanctions.map(mapSanction);
    },
  }));

// ---- mutations ----

const invalidateBoards = (qc: QueryClient) => qc.invalidateQueries({ queryKey: boardsKeys.all });

const useBoardsMutation = <TInput, TOut>(fn: (input: TInput) => Promise<TOut>) => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: fn,
    onSuccess: () => invalidateBoards(qc),
  }));
};

export const useCreateBoard = () =>
  useBoardsMutation(async (input: { slug: string; name: string; description: string }) => {
    const res = await client.createBoard(create(CreateBoardRequestSchema, input));
    return res.board ? mapBoard(res.board) : undefined;
  });

export interface NewPost {
  boardSlug: string;
  title: string;
  url: string;
  body: string;
  attachment?: { kind: AttachmentKindName; ref: string };
}

export const useCreatePost = () =>
  useBoardsMutation(async (input: NewPost) => {
    const res = await client.createPost(
      create(CreatePostRequestSchema, {
        boardSlug: input.boardSlug,
        title: input.title,
        url: input.url,
        body: input.body,
        attachment: input.attachment
          ? { kind: KIND_VALUES[input.attachment.kind], ref: input.attachment.ref }
          : undefined,
      }),
    );
    return res.post ? mapPost(res.post) : undefined;
  });

export const useDeletePost = () =>
  useBoardsMutation((id: string) => client.deletePost(create(DeletePostRequestSchema, { id })));

export const useCreateComment = () =>
  useBoardsMutation(async (input: { postId: string; parentId?: string; body: string }) => {
    const res = await client.createComment(
      create(CreateCommentRequestSchema, {
        postId: input.postId,
        parentId: input.parentId ?? "",
        body: input.body,
      }),
    );
    return res.comment ? mapComment(res.comment) : undefined;
  });

export const useDeleteComment = () =>
  useBoardsMutation((id: string) =>
    client.deleteComment(create(DeleteCommentRequestSchema, { id })),
  );

/** Not useBoardsMutation: the caller updates the row optimistically instead of refetching. */
export const votePost = async (postId: string, value: Vote) => {
  const res = await client.votePost(create(VotePostRequestSchema, { postId, value }));
  return { score: res.score, myVote: clampVote(res.myVote) };
};

export const useDeleteBoard = () =>
  useBoardsMutation((slug: string) =>
    client.deleteBoard(create(DeleteBoardRequestSchema, { slug })),
  );

export const useSanctionUser = () =>
  useBoardsMutation(
    async (input: { userId: string; kind: SanctionKindName; reason: string; days?: number }) => {
      const res = await client.sanctionUser(
        create(SanctionUserRequestSchema, {
          userId: input.userId,
          kind: input.kind === "ban" ? SanctionKind.BAN : SanctionKind.MUTE,
          reason: input.reason,
          expiresAt: input.days
            ? timestampFromDate(new Date(Date.now() + input.days * 24 * 60 * 60 * 1000))
            : undefined,
        }),
      );
      return res.sanction ? mapSanction(res.sanction) : undefined;
    },
  );

export const useLiftSanction = () =>
  useBoardsMutation((id: string) => client.liftSanction(create(LiftSanctionRequestSchema, { id })));
