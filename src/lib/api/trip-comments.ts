// Planning together: notes the owner and members leave on a trip or one of
// its stops. Anyone on the trip reads, writes and reports them; the author or
// the owner deletes one.
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/solid-query";
import { createClient, Code, ConnectError } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate, TimestampSchema, type Timestamp } from "@bufbuild/protobuf/wkt";
import { TripService } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import {
  AddTripCommentRequestSchema,
  DeleteTripCommentRequestSchema,
  ListReportedTripCommentsRequestSchema,
  ListTripCommentsRequestSchema,
  ReportTripCommentRequestSchema,
  ResolveTripCommentReportRequestSchema,
  TripCommentModerationAction,
  type ListTripCommentsResponse,
  type ReportedTripComment as ProtoReportedTripComment,
  type TripComment as ProtoTripComment,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/members_pb.js";
import { transport } from "../connect-transport";
import { useAppInfiniteQuery, useAppQuery } from "./authed-query";
import { mapPublicUser, type PublicUser } from "./social";

const client = createClient(TripService, transport);

export const MAX_COMMENT_LENGTH = 2000;

export type CommentReportReason = "spam" | "inappropriate" | "offensive" | "other";

export interface TripComment {
  id: string;
  tripId: string;
  /** Unset for a comment about the whole trip. */
  stopId?: string;
  author?: PublicUser;
  body: string;
  createdAt?: string;
  mine: boolean;
  canDelete: boolean;
}

export const mapComment = (c: ProtoTripComment): TripComment => ({
  id: c.id,
  tripId: c.tripId,
  stopId: c.stopId || undefined,
  author: mapPublicUser(c.author),
  body: c.body,
  createdAt: c.createdAt ? timestampDate(c.createdAt).toISOString() : undefined,
  mine: c.mine,
  canDelete: c.canDelete,
});

/** What a failed comment write means to the person writing it. */
export const commentErrorMessage = (err: unknown): string => {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.ResourceExhausted:
        return "That's a lot of comments for one hour. Try again in a bit.";
      case Code.InvalidArgument:
        return err.rawMessage.includes("stop")
          ? "That stop is no longer on the trip."
          : "A comment is 1 to 2000 characters.";
      case Code.NotFound:
        return "This comment is no longer here.";
      case Code.PermissionDenied:
        return "Only its author or the trip's planner can delete a comment.";
    }
  }
  return "Couldn't save that. Try again.";
};

export const commentKeys = {
  forTrip: (tripId: string) => ["trip-comments", tripId] as const,
  /** Every reported-comments page; under "trip-comments" so a resolve can refresh both. */
  reported: () => ["trip-comments", "reported"] as const,
  reportedPage: (page: number) => ["trip-comments", "reported", page] as const,
};

/**
 * Where an older page starts: the oldest comment's created_at, kept whole.
 * An ISO string would drop the server's microseconds, and a comment a few
 * microseconds older than the cursor would then be skipped.
 */
export interface CommentsCursor {
  seconds: string;
  nanos: number;
}

/** One ListTripComments answer: its comments oldest first. */
export interface TripCommentsPage {
  comments: TripComment[];
  hasMore: boolean;
  /** The first (oldest) comment's created_at, the cursor for the page before it. */
  oldest?: CommentsCursor;
}

export const toCommentsPage = (res: ListTripCommentsResponse): TripCommentsPage => {
  const first = res.comments[0]?.createdAt;
  return {
    comments: res.comments.map(mapComment),
    hasMore: res.hasMore,
    oldest: first ? { seconds: first.seconds.toString(), nanos: first.nanos } : undefined,
  };
};

export const cursorTimestamp = (cursor: CommentsCursor): Timestamp =>
  create(TimestampSchema, { seconds: BigInt(cursor.seconds), nanos: cursor.nanos });

/** The `before` for the next (older) page, or undefined when there is none. */
export const olderCommentsCursor = (last: TripCommentsPage | null): CommentsCursor | undefined =>
  last?.hasMore ? last.oldest : undefined;

/**
 * Every loaded page as one oldest-first list. Pages arrive newest first (the
 * first fetch is the latest comments, each "Load older" goes further back), so
 * they are read in reverse. Null pages are the server-render placeholder.
 */
export const flattenCommentPages = (
  data: InfiniteData<TripCommentsPage | null> | undefined,
): { comments: TripComment[]; hasMore: boolean } => {
  const pages = (data?.pages ?? []).filter((p): p is TripCommentsPage => !!p);
  const seen = new Set<string>();
  const comments: TripComment[] = [];
  for (const page of [...pages].reverse()) {
    for (const c of page.comments) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      comments.push(c);
    }
  }
  return { comments, hasMore: !!olderCommentsCursor(pages.at(-1) ?? null) };
};

/**
 * The trip's comments for anyone on it: the latest page first, and older pages
 * on `fetchNextPage`. Read them through `flattenCommentPages`. The key stays
 * `commentKeys.forTrip`, so every write's invalidation refetches all loaded pages.
 */
export const useTripComments = (tripId: () => string | undefined, enabled: () => boolean) =>
  useAppInfiniteQuery(() => ({
    queryKey: commentKeys.forTrip(tripId() ?? ""),
    enabled: !!tripId() && enabled(),
    initialPageParam: undefined as CommentsCursor | undefined,
    queryFn: async ({ pageParam }: { pageParam: CommentsCursor | undefined }) =>
      toCommentsPage(
        await client.listTripComments(
          create(ListTripCommentsRequestSchema, {
            tripId: tripId()!,
            before: pageParam ? cursorTimestamp(pageParam) : undefined,
          }),
        ),
      ),
    getNextPageParam: (last: TripCommentsPage | null) => olderCommentsCursor(last),
  }));

const useCommentMutation = <V extends { tripId: string }, R>(fn: (v: V) => Promise<R>) => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: fn,
    onSuccess: (_r: R, vars: V) => {
      void qc.invalidateQueries({ queryKey: commentKeys.forTrip(vars.tripId) });
    },
  }));
};

export const useAddTripComment = () =>
  useCommentMutation(async (i: { tripId: string; body: string; stopId?: string }) =>
    mapComment(
      await client.addTripComment(
        create(AddTripCommentRequestSchema, {
          tripId: i.tripId,
          body: i.body.trim(),
          stopId: i.stopId ?? "",
        }),
      ),
    ),
  );

export const useDeleteTripComment = () =>
  useCommentMutation(async (i: { tripId: string; commentId: string }) => {
    await client.deleteTripComment(
      create(DeleteTripCommentRequestSchema, { commentId: i.commentId }),
    );
  });

/** Reporting hides the comment from the reporter at once. */
export const useReportTripComment = () =>
  useCommentMutation(
    async (i: { tripId: string; commentId: string; reason: CommentReportReason }) => {
      await client.reportTripComment(
        create(ReportTripCommentRequestSchema, { commentId: i.commentId, reason: i.reason }),
      );
    },
  );

// ---- moderation (admin only; the server answers PermissionDenied to anyone else) ----

export type ModerationAction = "keep" | "remove";

export const REPORTED_PAGE_SIZE = 20;

export interface ReportedTripCommentItem {
  comment?: TripComment;
  /** Distinct people with an open report. */
  reportCount: number;
  reasons: { reason: string; count: number }[];
  /** Reporters' free text, newest first. */
  details: string[];
  lastReportedAt?: string;
  /** Out of the trip because of its reports. */
  hidden: boolean;
}

export const mapReportedComment = (r: ProtoReportedTripComment): ReportedTripCommentItem => ({
  comment: r.comment ? mapComment(r.comment) : undefined,
  reportCount: r.reportCount,
  reasons: r.reasons.map((x) => ({ reason: x.reason, count: x.count })),
  details: r.details.filter((d) => d.trim() !== ""),
  lastReportedAt: r.lastReportedAt ? timestampDate(r.lastReportedAt).toISOString() : undefined,
  hidden: r.hidden,
});

/** Comments with open reports, most reported first, one 1-based page at a time. */
export const useReportedTripComments = (page: () => number, enabled: () => boolean) =>
  useAppQuery(() => ({
    queryKey: commentKeys.reportedPage(page()),
    enabled: enabled(),
    retry: false,
    queryFn: async (): Promise<{ comments: ReportedTripCommentItem[]; hasMore: boolean }> => {
      const res = await client.listReportedTripComments(
        create(ListReportedTripCommentsRequestSchema, {
          limit: REPORTED_PAGE_SIZE,
          page: Math.max(1, page()),
        }),
      );
      return { comments: res.comments.map(mapReportedComment), hasMore: res.hasMore };
    },
  }));

/** Keep closes the open reports; remove takes the comment off the trip for everyone. */
export const useResolveTripCommentReport = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (i: { commentId: string; action: ModerationAction }) => {
      await client.resolveTripCommentReport(
        create(ResolveTripCommentReportRequestSchema, {
          commentId: i.commentId,
          action:
            i.action === "remove"
              ? TripCommentModerationAction.REMOVE
              : TripCommentModerationAction.KEEP,
        }),
      );
    },
    // The reported list and any trip's comments live under "trip-comments".
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["trip-comments"] }),
  }));
};
