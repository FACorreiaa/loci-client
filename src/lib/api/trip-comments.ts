// Planning together: notes the owner and members leave on a trip or one of
// its stops. Anyone on the trip reads, writes and reports them; the author or
// the owner deletes one.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient, Code, ConnectError } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { TripService } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import {
  AddTripCommentRequestSchema,
  DeleteTripCommentRequestSchema,
  ListTripCommentsRequestSchema,
  ReportTripCommentRequestSchema,
  type TripComment as ProtoTripComment,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/members_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
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
};

/** The trip's latest comments, oldest first, for anyone on it. */
export const useTripComments = (tripId: () => string | undefined, enabled: () => boolean) =>
  useAppQuery(() => ({
    queryKey: commentKeys.forTrip(tripId() ?? ""),
    enabled: !!tripId() && enabled(),
    queryFn: async () => {
      const res = await client.listTripComments(
        create(ListTripCommentsRequestSchema, { tripId: tripId()! }),
      );
      return { comments: res.comments.map(mapComment), hasMore: res.hasMore };
    },
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
