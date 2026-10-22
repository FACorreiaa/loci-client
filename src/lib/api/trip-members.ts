// Planning a trip together: invite links, joining, and the member list.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { TripService } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import {
  AcceptTripInviteRequestSchema,
  CreateTripInviteRequestSchema,
  GetTripInviteRequestSchema,
  RemoveTripMemberRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/members_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import { mapPublicUser, type PublicUser } from "./social";
import {
  mapTripMember,
  roleFromProto,
  roleToProto,
  tripKeys,
  type TripMember,
  type TripRole,
} from "./trips";

const client = createClient(TripService, transport);

export interface TripInvite {
  code: string;
  url: string;
  role: TripRole;
  expiresAt?: string;
}

/** What an invite link shows before joining. Readable signed out. */
export interface TripInvitePreview {
  tripId: string;
  title: string;
  cityName: string;
  startDate?: string;
  endDate?: string;
  dayCount: number;
  owner?: PublicUser;
  members: TripMember[];
  role: TripRole;
  joinable: boolean;
  alreadyMember: boolean;
}

export const tripInviteKeys = {
  byCode: (code: string) => ["trip-invite", code] as const,
};

/** The trip's live invite for a role, minted on first use. Owner only. */
export const useCreateTripInvite = () =>
  useMutation(() => ({
    mutationFn: async (i: { tripId: string; role?: Exclude<TripRole, "owner"> }) => {
      const res = await client.createTripInvite(
        create(CreateTripInviteRequestSchema, {
          tripId: i.tripId,
          role: roleToProto(i.role ?? "co_planner"),
        }),
      );
      return {
        code: res.code,
        url: res.url,
        role: roleFromProto(res.role) ?? "co_planner",
        expiresAt: res.expiresAt ? timestampDate(res.expiresAt).toISOString() : undefined,
      } satisfies TripInvite;
    },
  }));

export const useTripInvite = (code: () => string | undefined) =>
  useAppQuery(() => ({
    queryKey: tripInviteKeys.byCode(code() ?? ""),
    enabled: !!code(),
    retry: false,
    queryFn: async (): Promise<TripInvitePreview> => {
      const p = await client.getTripInvite(create(GetTripInviteRequestSchema, { code: code()! }));
      return {
        tripId: p.tripId,
        title: p.title,
        cityName: p.cityName,
        startDate: p.startDate || undefined,
        endDate: p.endDate || undefined,
        dayCount: p.dayCount,
        owner: mapPublicUser(p.owner),
        members: p.members.map(mapTripMember).filter((m): m is TripMember => !!m),
        role: roleFromProto(p.role) ?? "co_planner",
        joinable: p.joinable,
        alreadyMember: p.alreadyMember,
      };
    },
  }));

/** Joins the invite's trip; returns its id. Joining again is harmless. */
export const useAcceptTripInvite = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (code: string) => {
      const res = await client.acceptTripInvite(create(AcceptTripInviteRequestSchema, { code }));
      return { tripId: res.tripId, role: roleFromProto(res.role) };
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: tripKeys.list() });
      void qc.invalidateQueries({ queryKey: tripKeys.detail(res.tripId) });
    },
  }));
};

/** The owner removes anyone; a member removes only themselves (leaving). */
export const useRemoveTripMember = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (i: { tripId: string; userId: string }) => {
      await client.removeTripMember(create(RemoveTripMemberRequestSchema, i));
    },
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: tripKeys.list() });
      void qc.invalidateQueries({ queryKey: tripKeys.detail(vars.tripId) });
    },
  }));
};
