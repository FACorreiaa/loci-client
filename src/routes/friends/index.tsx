import { createSignal, For, Match, Show, Switch } from "solid-js";
import { Title } from "@solidjs/meta";
import { A, Navigate, useSearchParams } from "@solidjs/router";
import { Search } from "lucide-solid";
import { ProtectedRoute } from "~/contexts/AuthContext";
import { Button } from "~/ui/button";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "~/ui/tabs";
import UserAvatar from "~/components/social/UserAvatar";
import FollowButton from "~/components/social/FollowButton";
import FeedItemCard from "~/components/social/FeedItemCard";
import FriendTripCard from "~/components/social/FriendTripCard";
import InviteCard from "~/components/social/InviteCard";
import {
  profilePath,
  useCancelFollowRequest,
  useFeed,
  useFollowRequests,
  useFollows,
  useRemoveFollower,
  useRespondFollowRequest,
  useSearchUsers,
  type FollowEntry,
  type PublicUser,
} from "~/lib/api/social";
import { useFriendTrips } from "~/lib/api/trips";
import { useAuthGate } from "~/lib/auth/useAuthGate";

const TABS = ["feed", "trips", "followers", "following", "requests", "add"] as const;
type Tab = (typeof TABS)[number];

/** Links from before following ("?tab=friends") land on the people you follow. */
const LEGACY_TABS: Record<string, Tab> = { friends: "following" };

function PersonRow(props: {
  user: PublicUser;
  children?: import("solid-js").JSX.Element;
  sub?: string;
}) {
  const href = () => profilePath(props.user);
  return (
    <li class="flex items-center gap-3 py-3">
      <UserAvatar user={props.user} />
      <div class="min-w-0 flex-1">
        <Show when={href()} fallback={<p class="truncate font-medium">{props.user.displayName}</p>}>
          {(h) => (
            <A href={h()} class="block truncate font-medium hover:underline">
              {props.user.displayName}
            </A>
          )}
        </Show>
        <p class="truncate text-sm text-muted-foreground">
          <Show when={props.user.username}>@{props.user.username}</Show>
          <Show when={props.sub ?? props.user.homeCity}>
            {(s) => (
              <>
                <Show when={props.user.username}> · </Show>
                {s()}
              </>
            )}
          </Show>
        </p>
      </div>
      <div class="flex shrink-0 gap-2">{props.children}</div>
    </li>
  );
}

function Empty(props: { children: import("solid-js").JSX.Element }) {
  return <p class="py-10 text-center text-sm text-muted-foreground">{props.children}</p>;
}

function FollowRows(props: {
  entries?: FollowEntry[];
  loading: boolean;
  empty: string;
  followers?: boolean;
}) {
  const remove = useRemoveFollower();
  return (
    <Show
      when={props.entries?.length}
      fallback={<Empty>{props.loading ? "Loading…" : props.empty}</Empty>}
    >
      <ul class="divide-y divide-border">
        <For each={props.entries}>
          {(f) => (
            <PersonRow
              user={f.user}
              sub={f.edge.state === "following" && f.edge.followsYou ? "Friend" : undefined}
            >
              <FollowButton user={f.user} edge={f.edge} size="sm" />
              <Show when={props.followers}>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(f.user.id)}
                  aria-label={`Remove ${f.user.displayName} from your followers`}
                >
                  Remove
                </Button>
              </Show>
            </PersonRow>
          )}
        </For>
      </ul>
    </Show>
  );
}

function FriendsPage() {
  const [params, setParams] = useSearchParams<{ tab?: string }>();
  // The leaderboard and progress tabs moved to the field notebook.
  const movedToField = () => params.tab === "leaderboard" || params.tab === "progress";
  const gate = useAuthGate();
  const tab = (): Tab => {
    const t = LEGACY_TABS[params.tab ?? ""] ?? params.tab ?? "";
    return (TABS as readonly string[]).includes(t) ? (t as Tab) : "feed";
  };

  const followersQuery = useFollows(
    () => "",
    () => true,
    () => gate() && tab() === "followers",
  );
  const followingQuery = useFollows(
    () => "",
    () => false,
    () => gate() && tab() === "following",
  );
  const incomingQuery = useFollowRequests("incoming", () => gate());
  const outgoingQuery = useFollowRequests("outgoing", () => gate() && tab() === "requests");
  const tripsQuery = useFriendTrips(() => gate() && tab() === "trips");
  const feedQuery = useFeed(() => gate() && tab() === "feed");
  const respond = useRespondFollowRequest();
  const cancel = useCancelFollowRequest();

  const followers = () => (followersQuery.isSuccess ? followersQuery.data : undefined);
  const following = () => (followingQuery.isSuccess ? followingQuery.data : undefined);
  const incoming = () => (incomingQuery.isSuccess ? incomingQuery.data : undefined) ?? [];
  const outgoing = () => (outgoingQuery.isSuccess ? outgoingQuery.data : undefined) ?? [];
  const trips = () => (tripsQuery.isSuccess ? tripsQuery.data : undefined);
  const feed = () =>
    feedQuery.isSuccess ? feedQuery.data.pages.flatMap((p) => p.items) : undefined;

  const [query, setQuery] = createSignal("");
  const searchQuery = useSearchUsers(query);
  const results = () => (searchQuery.isSuccess ? searchQuery.data : undefined);

  return (
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Show when={movedToField()}>
        <Navigate href="/field?scope=friends" />
      </Show>
      <Title>People · Loci</Title>
      <header class="mb-6">
        <p class="font-coord mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Your travel circle
        </p>
        <h1 class="text-3xl">People</h1>
        <p class="mt-2 text-muted-foreground">
          Follow travellers to see where they go. Follow each other and you're friends: you see each
          other's friends-only trips.
        </p>
      </header>

      <Tabs
        value={tab()}
        onChange={(v: string) => setParams({ tab: v === "feed" ? undefined : v })}
      >
        <div class="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList class="min-w-max">
            <TabsTrigger value="feed">Feed</TabsTrigger>
            <TabsTrigger value="trips">Trips</TabsTrigger>
            <TabsTrigger value="followers">Followers</TabsTrigger>
            <TabsTrigger value="following">Following</TabsTrigger>
            <TabsTrigger value="requests">
              Requests
              <Show when={incoming().length}>
                <span class="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                  {incoming().length}
                </span>
              </Show>
            </TabsTrigger>
            <TabsTrigger value="add">Find people</TabsTrigger>
            <TabsIndicator />
          </TabsList>
        </div>

        <TabsContent value="feed">
          <Switch>
            <Match when={feedQuery.isLoading}>
              <Empty>Loading your feed…</Empty>
            </Match>
            <Match when={feed()?.length}>
              <ul class="space-y-3">
                <For each={feed()}>{(item) => <FeedItemCard item={item} />}</For>
              </ul>
              <Show when={feedQuery.hasNextPage}>
                <div class="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    disabled={feedQuery.isFetchingNextPage}
                    onClick={() => void feedQuery.fetchNextPage()}
                  >
                    {feedQuery.isFetchingNextPage ? "Loading…" : "Show more"}
                  </Button>
                </div>
              </Show>
            </Match>
            <Match when={feed()}>
              <Empty>
                Nothing here yet. When people you follow earn an achievement, reach a new city or
                finish a trip, it shows up here.{" "}
                <button class="underline" onClick={() => setParams({ tab: "add" })}>
                  Find people to follow
                </button>
              </Empty>
            </Match>
          </Switch>
        </TabsContent>

        <TabsContent value="trips">
          <Switch>
            <Match when={tripsQuery.isLoading}>
              <Empty>Loading trips…</Empty>
            </Match>
            <Match when={trips()?.length}>
              <div class="grid gap-4 sm:grid-cols-2">
                <For each={trips()}>{(t) => <FriendTripCard trip={t} showOwner />}</For>
              </div>
            </Match>
            <Match when={trips()}>
              <Empty>
                No shared trips yet. Trips the people you follow make public, and friends' trips
                shared with friends, show up here.
              </Empty>
            </Match>
          </Switch>
        </TabsContent>

        <TabsContent value="followers">
          <FollowRows
            entries={followers()?.entries}
            loading={followersQuery.isLoading}
            empty="Nobody follows you yet. Send your invite link to someone you travel with."
            followers
          />
        </TabsContent>

        <TabsContent value="following">
          <FollowRows
            entries={following()?.entries}
            loading={followingQuery.isLoading}
            empty="You don't follow anyone yet."
          />
        </TabsContent>

        <TabsContent value="requests">
          <h2 class="text-sm font-medium text-muted-foreground">Asking to follow you</h2>
          <Show
            when={incoming().length}
            fallback={
              <Empty>
                No pending requests. Only a private account gets these: anyone can follow a public
                one.
              </Empty>
            }
          >
            <ul class="mb-6 divide-y divide-border">
              <For each={incoming()}>
                {(r) => (
                  <PersonRow user={r.from}>
                    <Button
                      size="sm"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ requestId: r.id, approve: true })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ requestId: r.id, approve: false })}
                    >
                      Decline
                    </Button>
                  </PersonRow>
                )}
              </For>
            </ul>
          </Show>
          <Show when={outgoing().length}>
            <h2 class="text-sm font-medium text-muted-foreground">Sent</h2>
            <ul class="divide-y divide-border">
              <For each={outgoing()}>
                {(r) => (
                  <PersonRow user={r.to}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(r.id)}
                    >
                      Cancel
                    </Button>
                  </PersonRow>
                )}
              </For>
            </ul>
          </Show>
        </TabsContent>

        <TabsContent value="add" class="space-y-6">
          <InviteCard />
          <section class="loci-card p-5" aria-labelledby="find-title">
            <h2 id="find-title" class="text-lg font-medium">
              Find by username
            </h2>
            <label class="relative mt-3 block">
              <Search
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                placeholder="@username"
                aria-label="Search people by username"
                autocomplete="off"
                class="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-4 text-foreground focus:border-ring focus:ring-2 focus:ring-ring"
              />
            </label>
            <Show when={query().trim().replace(/^@/, "").length >= 2}>
              <Show
                when={results()?.length}
                fallback={
                  <Empty>
                    {searchQuery.isFetching ? "Searching…" : "Nobody by that username."}
                  </Empty>
                }
              >
                <ul class="mt-2 divide-y divide-border">
                  <For each={results()}>
                    {(r) => (
                      <PersonRow user={r.user}>
                        <FollowButton user={r.user} edge={r.edge} size="sm" />
                      </PersonRow>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  );
}

export default function FriendsRoute() {
  return (
    <ProtectedRoute>
      <FriendsPage />
    </ProtectedRoute>
  );
}
