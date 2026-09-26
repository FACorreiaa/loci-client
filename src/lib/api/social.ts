// The friends layer — SocialService. Friendship is mutual: one side asks,
// the other accepts (or opens the other's invite link, which is consent on
// both sides). Everything a stranger may see about a user is a PublicUser:
// never an email or a phone number.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";
import {
  SocialService,
  Relationship as ProtoRelationship,
  RequestDirection,
  AcceptInviteRequestSchema,
  BlockUserRequestSchema,
  CancelFriendRequestRequestSchema,
  GetInviteRequestSchema,
  GetMyInviteRequestSchema,
  GetPublicProfileRequestSchema,
  ListFriendRequestsRequestSchema,
  ListFriendsRequestSchema,
  RemoveFriendRequestSchema,
  RespondFriendRequestRequestSchema,
  RotateInviteRequestSchema,
  SearchUsersRequestSchema,
  SendFriendRequestRequestSchema,
  UnblockUserRequestSchema,
  type Invite as ProtoInvite,
  type PublicUser as ProtoPublicUser,
  type FriendRequest as ProtoFriendRequest,
} from "@buf/loci_loci-proto.bufbuild_es/loci/social/social_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const client = createClient(SocialService, transport);

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  homeCity: string;
}

/** The caller's relation to another user. `unknown` = signed out. */
export type Relationship =
  | "unknown"
  | "none"
  | "requested"
  | "incoming"
  | "friends"
  | "blocked"
  | "self";

export interface Friend {
  user: PublicUser;
  since: string;
}

export interface FriendRequest {
  id: string;
  from: PublicUser;
  to: PublicUser;
  createdAt: string;
}

export interface Invite {
  code: string;
  url: string;
  expiresAt: string;
  inviter?: PublicUser;
}

export interface PublicProfile {
  user: PublicUser;
  stats: { cities: number; countries: number; visibleTrips: number; friends: number };
  relationship: Relationship;
  memberSince?: string;
}

// ---- mappers (pure, tested) ----

export const mapPublicUser = (u?: ProtoPublicUser): PublicUser | undefined =>
  u
    ? {
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatarUrl,
        homeCity: u.homeCity,
      }
    : undefined;

const EMPTY_USER: PublicUser = {
  id: "",
  username: "",
  displayName: "",
  avatarUrl: "",
  homeCity: "",
};

export const mapRelationship = (r: ProtoRelationship): Relationship => {
  switch (r) {
    case ProtoRelationship.NONE:
      return "none";
    case ProtoRelationship.REQUESTED:
      return "requested";
    case ProtoRelationship.INCOMING:
      return "incoming";
    case ProtoRelationship.FRIENDS:
      return "friends";
    case ProtoRelationship.BLOCKED:
      return "blocked";
    case ProtoRelationship.SELF:
      return "self";
    default:
      return "unknown";
  }
};

const iso = (t?: Timestamp) => (t ? timestampDate(t).toISOString() : "");

export const mapInvite = (i?: ProtoInvite): Invite | undefined =>
  i
    ? { code: i.code, url: i.url, expiresAt: iso(i.expiresAt), inviter: mapPublicUser(i.inviter) }
    : undefined;

const mapRequest = (r: ProtoFriendRequest): FriendRequest => ({
  id: r.id,
  from: mapPublicUser(r.from) ?? EMPTY_USER,
  to: mapPublicUser(r.to) ?? EMPTY_USER,
  createdAt: iso(r.createdAt),
});

/** "Ana Sousa" → "AS"; "rui" → "R". For avatar placeholders. */
export const initials = (u: Pick<PublicUser, "displayName" | "username">): string => {
  const name = (u.displayName || u.username || "?").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 1);
  return letters.toUpperCase();
};

/** Where a user's profile lives; undefined for someone without a username yet. */
export const profilePath = (u: Pick<PublicUser, "username">): string | undefined =>
  u.username ? `/u/${encodeURIComponent(u.username)}` : undefined;

// ---- query keys ----

export const socialKeys = {
  all: ["social"] as const,
  friends: () => ["social", "friends"] as const,
  requests: (dir: "incoming" | "outgoing") => ["social", "requests", dir] as const,
  invite: () => ["social", "invite"] as const,
  inviteByCode: (code: string) => ["social", "invite", code] as const,
  profile: (key: string) => ["social", "profile", key] as const,
  search: (q: string) => ["social", "search", q] as const,
};

// ---- queries ----

export const useFriends = (enabled: () => boolean = () => true) =>
  useAppQuery(() => ({
    queryKey: socialKeys.friends(),
    enabled: enabled(),
    queryFn: async (): Promise<Friend[]> => {
      const res = await client.listFriends(create(ListFriendsRequestSchema, {}));
      return res.friends.map((f) => ({
        user: mapPublicUser(f.user) ?? EMPTY_USER,
        since: iso(f.since),
      }));
    },
  }));

export const useFriendRequests = (
  dir: "incoming" | "outgoing",
  enabled: () => boolean = () => true,
) =>
  useAppQuery(() => ({
    queryKey: socialKeys.requests(dir),
    enabled: enabled(),
    // Pending requests are what the Nav badge counts: keep them fresh.
    refetchInterval: 60_000,
    queryFn: async (): Promise<FriendRequest[]> => {
      const res = await client.listFriendRequests(
        create(ListFriendRequestsRequestSchema, {
          direction: dir === "incoming" ? RequestDirection.INCOMING : RequestDirection.OUTGOING,
        }),
      );
      return res.requests.map(mapRequest);
    },
  }));

export const useMyInvite = (enabled: () => boolean = () => true) =>
  useAppQuery(() => ({
    queryKey: socialKeys.invite(),
    enabled: enabled(),
    staleTime: 60 * 60 * 1000,
    queryFn: async () =>
      mapInvite((await client.getMyInvite(create(GetMyInviteRequestSchema, {}))).invite),
  }));

export const useInvite = (code: () => string | undefined) =>
  useAppQuery(() => ({
    queryKey: socialKeys.inviteByCode(code() ?? ""),
    enabled: !!code(),
    retry: false,
    queryFn: async () => {
      const res = await client.getInvite(create(GetInviteRequestSchema, { code: code()! }));
      return { invite: mapInvite(res.invite), relationship: mapRelationship(res.relationship) };
    },
  }));

export const usePublicProfile = (username: () => string | undefined) =>
  useAppQuery(() => ({
    queryKey: socialKeys.profile(username() ?? ""),
    enabled: !!username(),
    retry: false,
    queryFn: async (): Promise<PublicProfile> => {
      const res = await client.getPublicProfile(
        create(GetPublicProfileRequestSchema, { target: { case: "username", value: username()! } }),
      );
      return {
        user: mapPublicUser(res.user) ?? EMPTY_USER,
        stats: {
          cities: res.stats?.cities ?? 0,
          countries: res.stats?.countries ?? 0,
          visibleTrips: res.stats?.visibleTrips ?? 0,
          friends: res.stats?.friends ?? 0,
        },
        relationship: mapRelationship(res.relationship),
        memberSince: res.memberSince ? iso(res.memberSince) : undefined,
      };
    },
  }));

export const useSearchUsers = (query: () => string) =>
  useAppQuery(() => {
    const q = query().trim().replace(/^@/, "");
    return {
      queryKey: socialKeys.search(q.toLowerCase()),
      enabled: q.length >= 2,
      staleTime: 30_000,
      queryFn: async () => {
        const res = await client.searchUsers(
          create(SearchUsersRequestSchema, { query: q, limit: 20 }),
        );
        return res.users.map((r) => ({
          user: mapPublicUser(r.user) ?? EMPTY_USER,
          relationship: mapRelationship(r.relationship),
        }));
      },
    };
  });

// ---- mutations ----

/** Any change to the graph refreshes every social view (friends, requests, profiles, feed). */
const useSocialMutation = <TInput, TOut>(fn: (input: TInput) => Promise<TOut>) => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: socialKeys.all });
      void qc.invalidateQueries({ queryKey: ["trips", "friends"] });
    },
  }));
};

export const useSendFriendRequest = () =>
  useSocialMutation(async (target: { userId?: string; username?: string }) => {
    const res = await client.sendFriendRequest(
      create(SendFriendRequestRequestSchema, {
        target: target.userId
          ? { case: "userId", value: target.userId }
          : { case: "username", value: target.username ?? "" },
      }),
    );
    return mapRelationship(res.relationship);
  });

export const useRespondFriendRequest = () =>
  useSocialMutation(async (i: { requestId: string; accept: boolean }) => {
    await client.respondFriendRequest(create(RespondFriendRequestRequestSchema, i));
  });

export const useCancelFriendRequest = () =>
  useSocialMutation(async (requestId: string) => {
    await client.cancelFriendRequest(create(CancelFriendRequestRequestSchema, { requestId }));
  });

export const useRemoveFriend = () =>
  useSocialMutation(async (userId: string) => {
    await client.removeFriend(create(RemoveFriendRequestSchema, { userId }));
  });

export const useBlockUser = () =>
  useSocialMutation(async (userId: string) => {
    await client.blockUser(create(BlockUserRequestSchema, { userId }));
  });

export const useUnblockUser = () =>
  useSocialMutation(async (userId: string) => {
    await client.unblockUser(create(UnblockUserRequestSchema, { userId }));
  });

export const useAcceptInvite = () =>
  useSocialMutation(async (code: string) => {
    const res = await client.acceptInvite(create(AcceptInviteRequestSchema, { code }));
    return mapPublicUser(res.friend?.user);
  });

export const useRotateInvite = () =>
  useSocialMutation(async () =>
    mapInvite((await client.rotateInvite(create(RotateInviteRequestSchema, {}))).invite),
  );
