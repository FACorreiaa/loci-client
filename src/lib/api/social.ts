// The people layer — SocialService. Following is one-way; two people who
// follow each other are friends (and see each other's friends-only trips).
// A private account approves its followers. Opening someone's invite link
// makes you friends at once. Everything a stranger may see about a user is a
// PublicUser: never an email or a phone number.
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";
import {
  SocialService,
  Relationship as ProtoRelationship,
  FollowState as ProtoFollowState,
  FeedItemKind,
  RequestDirection,
  AcceptInviteRequestSchema,
  BlockUserRequestSchema,
  CancelFollowRequestRequestSchema,
  CancelFriendRequestRequestSchema,
  CheerRequestSchema,
  FollowUserRequestSchema,
  GetSocialSettingsRequestSchema,
  ListFeedRequestSchema,
  ListFollowersRequestSchema,
  ListFollowingRequestSchema,
  ListFollowRequestsRequestSchema,
  RemoveFollowerRequestSchema,
  RespondFollowRequestRequestSchema,
  SetAccountPrivacyRequestSchema,
  UncheerRequestSchema,
  UnfollowRequestSchema,
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
  type FeedItem as ProtoFeedItem,
  type FollowEntry as ProtoFollowEntry,
} from "@buf/loci_loci-proto.bufbuild_es/loci/social/social_pb.js";
import { transport } from "../connect-transport";
import { useAppInfiniteQuery, useAppQuery } from "./authed-query";
import { mapSummary, type AchievementSummary } from "./achievements";

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
  /** Empty: the code does not expire. */
  expiresAt: string;
  inviter?: PublicUser;
  /** The message to send with the link, without the url. */
  shareText: string;
}

/** Whether the caller follows someone. `unknown` = signed out. */
export type FollowState = "unknown" | "none" | "requested" | "following" | "blocked" | "self";

/** Where the caller stands with someone, both ways. */
export interface Edge {
  state: FollowState;
  followsYou: boolean;
}

export interface PublicProfile {
  user: PublicUser;
  stats: {
    cities: number;
    countries: number;
    visibleTrips: number;
    friends: number;
    followers: number;
    following: number;
    achievements: number;
  };
  relationship: Relationship;
  edge: Edge;
  isPrivate: boolean;
  /** False for a private account the caller does not follow. */
  canView: boolean;
  showcase: AchievementSummary[];
  memberSince?: string;
}

export interface FollowEntry {
  user: PublicUser;
  since: string;
  edge: Edge;
}

export interface FollowList {
  entries: FollowEntry[];
  total: number;
}

export interface SocialSettings {
  isPrivate: boolean;
  pendingRequests: number;
}

export type FeedDetail =
  | { kind: "achievement"; achievement: AchievementSummary }
  | { kind: "city"; cityName: string; country: string }
  | {
      kind: "trip";
      finished: boolean;
      tripId: string;
      title: string;
      cityName: string;
      days: number;
    };

export interface FeedItem {
  id: string;
  actor: PublicUser;
  createdAt: string;
  detail: FeedDetail;
  cheers: number;
  cheeredByMe: boolean;
  cheerers: PublicUser[];
}

export interface FeedPage {
  items: FeedItem[];
  next: string;
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

export const mapFollowState = (s: ProtoFollowState): FollowState => {
  switch (s) {
    case ProtoFollowState.NONE:
      return "none";
    case ProtoFollowState.REQUESTED:
      return "requested";
    case ProtoFollowState.FOLLOWING:
      return "following";
    case ProtoFollowState.BLOCKED:
      return "blocked";
    case ProtoFollowState.SELF:
      return "self";
    default:
      return "unknown";
  }
};

/** Friends: each follows the other. */
export const isFriend = (e: Edge) => e.state === "following" && e.followsYou;

const iso = (t?: Timestamp) => (t ? timestampDate(t).toISOString() : "");

const mapFollowEntry = (f: ProtoFollowEntry): FollowEntry => ({
  user: mapPublicUser(f.user) ?? EMPTY_USER,
  since: iso(f.since),
  edge: { state: mapFollowState(f.followState), followsYou: f.followsYou },
});

/** A feed item, or undefined for a kind this client does not know. */
export const mapFeedItem = (i: ProtoFeedItem): FeedItem | undefined => {
  let detail: FeedDetail | undefined;
  const d = i.detail;
  if (i.kind === FeedItemKind.ACHIEVEMENT_UNLOCKED && d.case === "achievement") {
    detail = { kind: "achievement", achievement: mapSummary(d.value) };
  } else if (i.kind === FeedItemKind.NEW_CITY && d.case === "city") {
    detail = { kind: "city", cityName: d.value.cityName, country: d.value.country };
  } else if (
    (i.kind === FeedItemKind.TRIP_FINISHED || i.kind === FeedItemKind.TRIP_SHARED) &&
    d.case === "trip"
  ) {
    detail = {
      kind: "trip",
      finished: i.kind === FeedItemKind.TRIP_FINISHED,
      tripId: d.value.tripId,
      title: d.value.title,
      cityName: d.value.cityName,
      days: d.value.days,
    };
  }
  if (!detail) return undefined;
  return {
    id: i.id,
    actor: mapPublicUser(i.actor) ?? EMPTY_USER,
    createdAt: iso(i.createdAt),
    detail,
    cheers: i.cheerCount,
    cheeredByMe: i.cheeredByMe,
    cheerers: i.recentCheerers.flatMap((u) => mapPublicUser(u) ?? []),
  };
};

export const mapInvite = (i?: ProtoInvite): Invite | undefined =>
  i
    ? {
        code: i.code,
        url: i.url,
        expiresAt: iso(i.expiresAt),
        inviter: mapPublicUser(i.inviter),
        shareText: i.shareText,
      }
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
  follows: (userId: string, followers: boolean) =>
    ["social", followers ? "followers" : "following", userId] as const,
  followRequests: (dir: "incoming" | "outgoing") => ["social", "follow-requests", dir] as const,
  settings: () => ["social", "settings"] as const,
  feed: () => ["social", "feed"] as const,
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
          followers: res.stats?.followers ?? 0,
          following: res.stats?.following ?? 0,
          achievements: res.stats?.achievements ?? 0,
        },
        relationship: mapRelationship(res.relationship),
        edge: { state: mapFollowState(res.followState), followsYou: res.followsYou },
        isPrivate: res.isPrivate,
        canView: res.canView,
        showcase: res.showcase.map(mapSummary),
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
          edge: { state: mapFollowState(r.followState), followsYou: r.followsYou },
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

// ---- following ----

/** Followers (or the people followed) of userId; empty means the caller. First 100. */
export const useFollows = (
  userId: () => string,
  followers: () => boolean,
  enabled: () => boolean = () => true,
) =>
  useAppQuery(() => ({
    queryKey: socialKeys.follows(userId(), followers()),
    enabled: enabled(),
    retry: false,
    queryFn: async (): Promise<FollowList> => {
      const req = { userId: userId(), pageSize: 100 };
      const res = followers()
        ? await client.listFollowers(create(ListFollowersRequestSchema, req))
        : await client.listFollowing(create(ListFollowingRequestSchema, req));
      return { entries: res.entries.map(mapFollowEntry), total: res.total };
    },
  }));

export const useFollowRequests = (
  dir: "incoming" | "outgoing",
  enabled: () => boolean = () => true,
) =>
  useAppQuery(() => ({
    queryKey: socialKeys.followRequests(dir),
    enabled: enabled(),
    // Pending requests are what the Nav badge counts: keep them fresh.
    refetchInterval: 60_000,
    queryFn: async (): Promise<FriendRequest[]> => {
      const res = await client.listFollowRequests(
        create(ListFollowRequestsRequestSchema, {
          direction: dir === "incoming" ? RequestDirection.INCOMING : RequestDirection.OUTGOING,
        }),
      );
      return res.requests.map((r) => ({
        id: r.id,
        from: mapPublicUser(r.from) ?? EMPTY_USER,
        to: mapPublicUser(r.to) ?? EMPTY_USER,
        createdAt: iso(r.createdAt),
      }));
    },
  }));

export const useSocialSettings = (enabled: () => boolean = () => true) =>
  useAppQuery(() => ({
    queryKey: socialKeys.settings(),
    enabled: enabled(),
    queryFn: async (): Promise<SocialSettings> => {
      const s = (await client.getSocialSettings(create(GetSocialSettingsRequestSchema, {})))
        .settings;
      return { isPrivate: s?.isPrivate ?? false, pendingRequests: s?.pendingRequests ?? 0 };
    },
  }));

/** Follows someone: FOLLOWING, or REQUESTED for a private account. */
export const useFollow = () =>
  useSocialMutation(async (userId: string): Promise<Edge> => {
    const res = await client.follow(
      create(FollowUserRequestSchema, { target: { case: "userId", value: userId } }),
    );
    return { state: mapFollowState(res.followState), followsYou: res.followsYou };
  });

/** Stops following someone, or withdraws a pending request. */
export const useUnfollow = () =>
  useSocialMutation(async (userId: string) => {
    await client.unfollow(create(UnfollowRequestSchema, { userId }));
  });

export const useRemoveFollower = () =>
  useSocialMutation(async (userId: string) => {
    await client.removeFollower(create(RemoveFollowerRequestSchema, { userId }));
  });

export const useRespondFollowRequest = () =>
  useSocialMutation(async (i: { requestId: string; approve: boolean }) => {
    await client.respondFollowRequest(create(RespondFollowRequestRequestSchema, i));
  });

export const useCancelFollowRequest = () =>
  useSocialMutation(async (requestId: string) => {
    await client.cancelFollowRequest(create(CancelFollowRequestRequestSchema, { requestId }));
  });

export const useSetAccountPrivacy = () =>
  useSocialMutation(async (isPrivate: boolean): Promise<SocialSettings> => {
    const s = (
      await client.setAccountPrivacy(create(SetAccountPrivacyRequestSchema, { isPrivate }))
    ).settings;
    return { isPrivate: s?.isPrivate ?? false, pendingRequests: s?.pendingRequests ?? 0 };
  });

// ---- the following feed ----

const FEED_PAGE = 20;

export const useFeed = (enabled: () => boolean = () => true) =>
  useAppInfiniteQuery(() => ({
    queryKey: socialKeys.feed(),
    enabled: enabled(),
    initialPageParam: "",
    queryFn: async ({ pageParam }: { pageParam: string }): Promise<FeedPage> => {
      const res = await client.listFeed(
        create(ListFeedRequestSchema, { pageSize: FEED_PAGE, pageToken: pageParam }),
      );
      return {
        items: res.items.flatMap((i) => mapFeedItem(i) ?? []),
        next: res.nextPageToken,
      };
    },
    getNextPageParam: (last: FeedPage) => last.next || undefined,
  }));

/** Applies a cheer to one item of the cached feed. */
export const withCheer = (
  data: InfiniteData<FeedPage> | undefined,
  itemId: string,
  cheers: number,
  cheeredByMe: boolean,
): InfiniteData<FeedPage> | undefined =>
  data && {
    ...data,
    pages: data.pages.map((p) => ({
      ...p,
      items: p.items.map((i) => (i.id === itemId ? { ...i, cheers, cheeredByMe } : i)),
    })),
  };

/** Cheers (or takes back a cheer on) a feed item, showing it at once. */
export const useCheer = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (v: { item: FeedItem; on: boolean }) => {
      const res = v.on
        ? await client.cheer(create(CheerRequestSchema, { itemId: v.item.id }))
        : await client.uncheer(create(UncheerRequestSchema, { itemId: v.item.id }));
      return { cheers: res.cheerCount, cheeredByMe: res.cheeredByMe };
    },
    onMutate: (v) => {
      const prev = qc.getQueryData<InfiniteData<FeedPage>>(socialKeys.feed());
      const n = v.item.cheers + (v.on === v.item.cheeredByMe ? 0 : v.on ? 1 : -1);
      qc.setQueryData(socialKeys.feed(), withCheer(prev, v.item.id, Math.max(0, n), v.on));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(socialKeys.feed(), ctx.prev);
    },
    onSuccess: (res, v) => {
      qc.setQueryData(
        socialKeys.feed(),
        withCheer(
          qc.getQueryData<InfiniteData<FeedPage>>(socialKeys.feed()),
          v.item.id,
          res.cheers,
          res.cheeredByMe,
        ),
      );
    },
  }));
};
