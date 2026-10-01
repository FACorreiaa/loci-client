// The chat agent's proposed trip changes (ChatService.ApplyTripAction /
// DismissTripAction). The proposal lives on the server; the client sends its
// id, the option picked, and the trip version the card was shown against.
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  ApplyTripActionRequestSchema,
  DismissTripActionRequestSchema,
  type ConversationMessage,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import type { TripDraft as ProtoTripDraft } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { chatService } from "@/lib/api";

/** Components take this so tests can fake it. */
export interface TripActionApi {
  apply(
    proposalId: string,
    optionIndex: number | undefined,
    baseVersion: bigint,
  ): Promise<{ trip?: ProtoTripDraft; confirmation?: ConversationMessage }>;
  dismiss(proposalId: string): Promise<void>;
}

export const tripActionApi: TripActionApi = {
  async apply(proposalId, optionIndex, baseVersion) {
    const res = await chatService.applyTripAction(
      create(ApplyTripActionRequestSchema, { proposalId, optionIndex, baseVersion }),
    );
    return { trip: res.trip, confirmation: res.confirmation };
  },
  async dismiss(proposalId) {
    await chatService.dismissTripAction(create(DismissTripActionRequestSchema, { proposalId }));
  },
};

/** What the card says when a change can't be made. */
export const tripActionErrorMessage = (err: unknown): string => {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.FailedPrecondition:
        // The server says "trip version conflict" for a stale trip; anything
        // else here is a proposal already used, dismissed or expired.
        return err.rawMessage.includes("version")
          ? "This trip changed since the suggestion. Ask again to get a fresh one."
          : "This suggestion was already used or has expired. Ask again.";
      case Code.NotFound:
        return "This suggestion is no longer available.";
      case Code.InvalidArgument:
        return err.rawMessage || "That change can't be made to this trip.";
    }
  }
  return "Couldn't make that change. Try again.";
};
