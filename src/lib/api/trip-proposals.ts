// Planning together: a trip's co-planners suggest stop edits, everyone on
// the trip reacts, and the owner applies or turns them down. Applying and
// dismissing are the chat cards' own RPCs (trip-actions.ts); a proposal is
// the same server object whether the planner or a friend made it.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import {
  ListTripProposalsRequestSchema,
  ProposalSource,
  ProposalStatus,
  ProposeTripChangeRequestSchema,
  ReactToTripProposalRequestSchema,
  TripActionSchema,
  type ActionProposal,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { chatService } from "@/lib/api";
import { useAppQuery } from "./authed-query";
import { mapPublicUser, type PublicUser } from "./social";
import { mapTrip, rememberTrip, toProtoStop, tripKeys, type TripStop } from "./trips";
import { tripActionApi } from "./trip-actions";

/** A stop edit a co-planner suggests from the trip page. */
export type SuggestedChange =
  | { kind: "addStop"; dayId: string; stop: TripStop }
  | { kind: "removeStop"; stopId: string }
  | { kind: "replaceStop"; stopId: string; replacement: TripStop }
  | { kind: "moveStop"; stopId: string; toDayId: string; toIndex: number };

export type ProposalReaction = -1 | 0 | 1;

export interface TripProposal {
  id: string;
  tripId: string;
  summary: string;
  kind?: string;
  proposer?: PublicUser;
  source: "chat" | "editor";
  status: "pending" | "applied" | "dismissed";
  upVotes: number;
  downVotes: number;
  myReaction: ProposalReaction;
  /** A hotel search needs a pick, which happens in the planner's chat. */
  needsPick: boolean;
  createdAt?: string;
}

export const mapProposal = (p: ActionProposal): TripProposal => ({
  id: p.id,
  tripId: p.tripId,
  summary: p.summary,
  kind: p.action?.kind.case,
  proposer: mapPublicUser(p.proposer),
  source: p.source === ProposalSource.EDITOR ? "editor" : "chat",
  status:
    p.status === ProposalStatus.APPLIED
      ? "applied"
      : p.status === ProposalStatus.DISMISSED
        ? "dismissed"
        : "pending",
  upVotes: p.upVotes,
  downVotes: p.downVotes,
  myReaction: (Math.sign(p.myReaction) as ProposalReaction) || 0,
  needsPick: p.action?.kind.case === "searchHotels",
  createdAt: p.createdAt ? timestampDate(p.createdAt).toISOString() : undefined,
});

const toProtoAction = (c: SuggestedChange) => {
  switch (c.kind) {
    case "addStop":
      return create(TripActionSchema, {
        kind: { case: "addStop", value: { dayId: c.dayId, stop: toProtoStop(c.stop) } },
      });
    case "removeStop":
      return create(TripActionSchema, {
        kind: { case: "removeStop", value: { stopId: c.stopId } },
      });
    case "replaceStop":
      return create(TripActionSchema, {
        kind: {
          case: "replaceStop",
          value: { stopId: c.stopId, replacement: toProtoStop(c.replacement) },
        },
      });
    case "moveStop":
      return create(TripActionSchema, {
        kind: {
          case: "moveStop",
          value: { stopId: c.stopId, toDayId: c.toDayId, toIndex: c.toIndex },
        },
      });
  }
};

/** What a failed apply means on the trip page. */
export const applyErrorMessage = (err: unknown): string => {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.FailedPrecondition:
        return err.rawMessage.includes("version")
          ? "The trip just changed. It's reloaded: look again, then apply."
          : "This suggestion was already applied, turned down or has expired.";
      case Code.InvalidArgument:
        return "That stop or day is no longer on the trip. Turn this one down.";
      case Code.NotFound:
        return "This suggestion is no longer available.";
      case Code.PermissionDenied:
        return "Only the trip's planner can apply suggestions.";
    }
  }
  return "Couldn't make that change. Try again.";
};

export const proposalKeys = {
  forTrip: (tripId: string) => ["trip-proposals", tripId] as const,
};

/** The trip's open proposals, newest first, for anyone on it. */
export const useTripProposals = (tripId: () => string | undefined, enabled: () => boolean) =>
  useAppQuery(() => ({
    queryKey: proposalKeys.forTrip(tripId() ?? ""),
    enabled: !!tripId() && enabled(),
    queryFn: async () => {
      const res = await chatService.listTripProposals(
        create(ListTripProposalsRequestSchema, { tripId: tripId()! }),
      );
      return res.proposals.map(mapProposal);
    },
  }));

export const useProposeTripChange = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (i: { tripId: string; baseVersion: bigint; change: SuggestedChange }) =>
      mapProposal(
        await chatService.proposeTripChange(
          create(ProposeTripChangeRequestSchema, {
            tripId: i.tripId,
            baseVersion: i.baseVersion,
            action: toProtoAction(i.change),
          }),
        ),
      ),
    onSuccess: (_p, vars) => {
      void qc.invalidateQueries({ queryKey: proposalKeys.forTrip(vars.tripId) });
    },
  }));
};

export const useReactToProposal = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (i: { tripId: string; proposalId: string; value: ProposalReaction }) =>
      mapProposal(
        await chatService.reactToTripProposal(
          create(ReactToTripProposalRequestSchema, { proposalId: i.proposalId, value: i.value }),
        ),
      ),
    onSuccess: (updated, vars) => {
      qc.setQueryData<TripProposal[]>(proposalKeys.forTrip(vars.tripId), (list) =>
        list?.map((p) => (p.id === updated.id ? updated : p)),
      );
    },
  }));
};

/**
 * The owner (or a co-planner the owner lets apply) applies a suggestion
 * against the trip as they see it. Only the owner gets the trip back; anyone
 * else reads it again.
 */
export const useApplyProposal = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (i: { tripId: string; proposalId: string; baseVersion: bigint }) => {
      const res = await tripActionApi.apply(i.proposalId, undefined, i.baseVersion);
      return res.trip ? mapTrip(res.trip) : undefined;
    },
    onSuccess: (trip, vars) => {
      if (trip) rememberTrip(qc, trip);
      else void qc.invalidateQueries({ queryKey: tripKeys.detail(vars.tripId) });
      void qc.invalidateQueries({ queryKey: proposalKeys.forTrip(vars.tripId) });
    },
  }));
};

/** The owner turns a suggestion down, or its proposer takes it back. */
export const useDismissProposal = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (i: { tripId: string; proposalId: string }) => {
      await tripActionApi.dismiss(i.proposalId);
    },
    onSuccess: (_r, vars) => {
      qc.setQueryData<TripProposal[]>(proposalKeys.forTrip(vars.tripId), (list) =>
        list?.filter((p) => p.id !== vars.proposalId),
      );
    },
  }));
};
