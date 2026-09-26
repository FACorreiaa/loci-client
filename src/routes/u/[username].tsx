import { createSignal, For, Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useParams } from "@solidjs/router";
import { MapPin } from "lucide-solid";
import { Button } from "~/ui/button";
import UserAvatar from "~/components/social/UserAvatar";
import RelationshipButton from "~/components/social/RelationshipButton";
import FriendTripCard from "~/components/social/FriendTripCard";
import { useBlockUser, usePublicProfile } from "~/lib/api/social";
import { useUserTrips } from "~/lib/api/trips";
import { useAuthGate } from "~/lib/auth/useAuthGate";

const memberSince = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : undefined;

/** Someone's travel profile: who they are, where they've been, what they share. */
export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const profileQuery = usePublicProfile(() => params.username);
  const profile = () => (profileQuery.isSuccess ? profileQuery.data : undefined);
  const tripsQuery = useUserTrips(() => profile()?.user.id);
  const trips = () => (tripsQuery.isSuccess ? tripsQuery.data : undefined);
  const block = useBlockUser();
  const [confirmBlock, setConfirmBlock] = createSignal(false);

  const gate = useAuthGate();
  const canBlock = () => {
    if (!gate()) return false;
    const r = profile()?.relationship;
    return r !== undefined && r !== "self" && r !== "blocked" && r !== "unknown";
  };

  return (
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Title>{`${profile()?.user.displayName ?? `@${params.username}`} · Loci`}</Title>
      <Meta name="robots" content="noindex" />

      <Show when={profileQuery.isError}>
        <section class="loci-card mx-auto max-w-lg p-8 text-center">
          <h1 class="text-2xl">No traveller by that name</h1>
          <p class="mt-2 text-muted-foreground">
            Check the username, or ask them for their invite link.
          </p>
          <Button as={A} href="/" class="mt-6">
            Go home
          </Button>
        </section>
      </Show>

      <Show when={profile()}>
        {(p) => (
          <>
            <section class="loci-card flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
              <UserAvatar user={p().user} size="lg" />
              <div class="min-w-0 flex-1">
                <h1 class="text-2xl">{p().user.displayName}</h1>
                <p class="text-muted-foreground">@{p().user.username}</p>
                <p class="mt-1 flex flex-wrap justify-center gap-x-3 text-sm text-muted-foreground sm:justify-start">
                  <Show when={p().user.homeCity}>
                    <span class="inline-flex items-center gap-1">
                      <MapPin class="h-3.5 w-3.5" aria-hidden="true" />
                      {p().user.homeCity}
                    </span>
                  </Show>
                  <Show when={memberSince(p().memberSince)}>
                    {(d) => <span>On Loci since {d()}</span>}
                  </Show>
                </p>
              </div>
              <div class="flex shrink-0 flex-col items-center gap-2 sm:items-end">
                <RelationshipButton user={p().user} relationship={p().relationship} />
                <Show when={canBlock()}>
                  <button
                    type="button"
                    class="text-xs text-muted-foreground hover:text-destructive"
                    disabled={block.isPending}
                    onClick={() =>
                      confirmBlock() ? block.mutate(p().user.id) : setConfirmBlock(true)
                    }
                    onBlur={() => setConfirmBlock(false)}
                  >
                    {confirmBlock() ? "Block — they won't be able to find you" : "Block"}
                  </button>
                </Show>
              </div>
            </section>

            <dl class="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <For
                each={
                  [
                    ["Cities", p().stats.cities],
                    ["Countries", p().stats.countries],
                    ["Trips shared", p().stats.visibleTrips],
                    ["Friends", p().stats.friends],
                  ] as const
                }
              >
                {([label, value]) => (
                  <div class="loci-card p-4 text-center">
                    <dd class="text-2xl font-semibold">{value}</dd>
                    <dt class="font-coord mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {label}
                    </dt>
                  </div>
                )}
              </For>
            </dl>

            <h2 class="mb-3 text-lg font-medium">Trips</h2>
            <Show
              when={trips()?.length}
              fallback={
                <p class="py-8 text-center text-sm text-muted-foreground">
                  {tripsQuery.isLoading
                    ? "Loading…"
                    : p().relationship === "friends" || p().relationship === "self"
                      ? "No shared trips yet."
                      : "No public trips. Friends see the trips shared with friends."}
                </p>
              }
            >
              <div class="grid gap-4 sm:grid-cols-2">
                <For each={trips()}>{(t) => <FriendTripCard trip={t} />}</For>
              </div>
            </Show>
          </>
        )}
      </Show>
    </main>
  );
}
