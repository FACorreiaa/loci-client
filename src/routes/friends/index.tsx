import { createSignal, For, Match, Show, Switch } from "solid-js";
import { Title } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import { Search } from "lucide-solid";
import { ProtectedRoute } from "~/contexts/AuthContext";
import { Button } from "~/ui/button";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "~/ui/tabs";
import UserAvatar from "~/components/social/UserAvatar";
import RelationshipButton from "~/components/social/RelationshipButton";
import FriendTripCard from "~/components/social/FriendTripCard";
import InviteCard from "~/components/social/InviteCard";
import {
  profilePath,
  useCancelFriendRequest,
  useFriendRequests,
  useFriends,
  useRespondFriendRequest,
  useSearchUsers,
  type PublicUser,
} from "~/lib/api/social";
import { useFriendTrips } from "~/lib/api/trips";
import { useAuthGate } from "~/lib/auth/useAuthGate";
import { capture } from "~/lib/analytics";

const TABS = ["trips", "friends", "requests", "add"] as const;
type Tab = (typeof TABS)[number];

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

function FriendsPage() {
  const [params, setParams] = useSearchParams<{ tab?: string }>();
  const gate = useAuthGate();
  const tab = (): Tab =>
    (TABS as readonly string[]).includes(params.tab ?? "") ? (params.tab as Tab) : "trips";

  const friendsQuery = useFriends(() => gate());
  const incomingQuery = useFriendRequests("incoming", () => gate());
  const outgoingQuery = useFriendRequests("outgoing", () => gate());
  const feedQuery = useFriendTrips(() => gate());
  const respond = useRespondFriendRequest();
  const cancel = useCancelFriendRequest();

  const friends = () => (friendsQuery.isSuccess ? friendsQuery.data : undefined);
  const incoming = () => (incomingQuery.isSuccess ? incomingQuery.data : undefined) ?? [];
  const outgoing = () => (outgoingQuery.isSuccess ? outgoingQuery.data : undefined) ?? [];
  const feed = () => (feedQuery.isSuccess ? feedQuery.data : undefined);

  const [query, setQuery] = createSignal("");
  const searchQuery = useSearchUsers(query);
  const results = () => (searchQuery.isSuccess ? searchQuery.data : undefined);

  return (
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Title>Friends · Loci</Title>
      <header class="mb-6">
        <p class="font-coord mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Your travel circle
        </p>
        <h1 class="text-3xl">Friends</h1>
        <p class="mt-2 text-muted-foreground">
          See where your friends are going, and copy the trips you like.
        </p>
      </header>

      <Tabs
        value={tab()}
        onChange={(v: string) => setParams({ tab: v === "trips" ? undefined : v })}
      >
        <TabsList class="mb-6">
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="friends">
            Friends
            <Show when={friends()?.length}>
              {(n) => <span class="ml-1.5 text-muted-foreground">{n()}</span>}
            </Show>
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            <Show when={incoming().length}>
              <span class="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                {incoming().length}
              </span>
            </Show>
          </TabsTrigger>
          <TabsTrigger value="add">Add friends</TabsTrigger>
          <TabsIndicator />
        </TabsList>

        <TabsContent value="trips">
          <Switch>
            <Match when={feedQuery.isLoading}>
              <Empty>Loading your friends' trips…</Empty>
            </Match>
            <Match when={feed()?.length}>
              <div class="grid gap-4 sm:grid-cols-2">
                <For each={feed()}>{(t) => <FriendTripCard trip={t} showOwner />}</For>
              </div>
            </Match>
            <Match when={feed()}>
              <Empty>
                No shared trips yet. When a friend shares a trip with friends or publicly, it shows
                up here.{" "}
                <button class="underline" onClick={() => setParams({ tab: "add" })}>
                  Invite someone
                </button>
              </Empty>
            </Match>
          </Switch>
        </TabsContent>

        <TabsContent value="friends">
          <Show
            when={friends()?.length}
            fallback={
              <Empty>
                {friendsQuery.isLoading
                  ? "Loading…"
                  : "No friends yet — send your invite link to someone you travel with."}
              </Empty>
            }
          >
            <ul class="divide-y divide-border">
              <For each={friends()}>
                {(f) => (
                  <PersonRow user={f.user}>
                    <RelationshipButton user={f.user} relationship="friends" size="sm" />
                  </PersonRow>
                )}
              </For>
            </ul>
          </Show>
        </TabsContent>

        <TabsContent value="requests">
          <h2 class="text-sm font-medium text-muted-foreground">Waiting on you</h2>
          <Show when={incoming().length} fallback={<Empty>No pending requests.</Empty>}>
            <ul class="mb-6 divide-y divide-border">
              <For each={incoming()}>
                {(r) => (
                  <PersonRow user={r.from}>
                    <Button
                      size="sm"
                      disabled={respond.isPending}
                      onClick={() =>
                        respond.mutate(
                          { requestId: r.id, accept: true },
                          { onSuccess: () => capture("friend_added", { via: "request" }) },
                        )
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ requestId: r.id, accept: false })}
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
                        <RelationshipButton user={r.user} relationship={r.relationship} size="sm" />
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
