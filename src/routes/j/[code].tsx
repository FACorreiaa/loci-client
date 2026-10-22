import { For, Match, onMount, Show, Switch } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { CalendarDays, Loader2, MapPin } from "lucide-solid";
import { Button } from "~/ui/button";
import UserAvatar from "~/components/social/UserAvatar";
import { useAuth } from "~/contexts/AuthContext";
import { useAcceptTripInvite, useTripInvite } from "~/lib/api/trip-members";
import { capture } from "~/lib/analytics";
import { formatDateRange } from "~/lib/trip-format";

/**
 * A trip invite link. It shows the trip's outline (city, dates, who is
 * going) to anyone, signed out included; joining needs an account, so a
 * signed-out visitor signs up or in first and is brought back here to tap
 * Join.
 *
 * Distinct from /t/{code}, which opens a trip read-only for anyone with the
 * link: this one puts you on the trip.
 */
export default function TripInvitePage() {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const inviteQuery = useTripInvite(() => params.code);
  const accept = useAcceptTripInvite();
  const invite = () => (inviteQuery.isSuccess ? inviteQuery.data : undefined);
  const here = () => `/j/${encodeURIComponent(params.code)}`;
  const ownerName = () => invite()?.owner?.displayName ?? "A friend";
  const dates = () => {
    const i = invite();
    return i ? formatDateRange([i.startDate, i.endDate]) : undefined;
  };

  onMount(() => capture("trip_invite_opened", { signed_in: isAuthenticated() }));

  const signIn = (to: "signup" | "signin") => {
    try {
      sessionStorage.setItem("auth_return_to", here());
    } catch {
      /* storage disabled: the signin returnTo below still brings them back */
    }
    navigate(
      to === "signup" ? "/auth/signup" : `/auth/signin?returnTo=${encodeURIComponent(here())}`,
    );
  };

  const join = () =>
    accept.mutate(params.code, {
      onSuccess: (res) => navigate(`/trips/${encodeURIComponent(res.tripId)}`),
    });

  return (
    <main class="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 py-12">
      <Title>{`${ownerName()} invited you to plan a trip · Loci`}</Title>
      <Meta name="robots" content="noindex" />
      <section class="loci-card w-full p-8 text-center">
        <Switch>
          <Match when={inviteQuery.isLoading}>
            <Loader2
              class="mx-auto h-6 w-6 animate-spin text-muted-foreground"
              aria-label="Loading invite"
            />
          </Match>
          <Match when={inviteQuery.isError || !invite()}>
            <p class="text-muted-foreground">This invite link doesn't open a trip.</p>
            <Button as={A} href="/" class="mt-6">
              Go home
            </Button>
          </Match>
          <Match when={invite()}>
            {(i) => (
              <>
                <p class="text-sm text-muted-foreground">
                  {ownerName()} invited you to {i().role === "viewer" ? "follow" : "plan"} a trip
                </p>
                <h1 class="mt-2 text-2xl">{i().title}</h1>
                <div class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <Show when={i().cityName}>
                    <span class="inline-flex items-center gap-1.5">
                      <MapPin class="h-4 w-4 text-accent" aria-hidden="true" />
                      {i().cityName}
                    </span>
                  </Show>
                  <span class="inline-flex items-center gap-1.5">
                    <CalendarDays class="h-4 w-4 text-accent" aria-hidden="true" />
                    {dates() ?? `${i().dayCount} day${i().dayCount === 1 ? "" : "s"}`}
                  </span>
                </div>

                <ul class="mt-6 flex justify-center -space-x-2" aria-label="Who's going">
                  <For each={i().members.slice(0, 6)}>
                    {(m) => (
                      <li title={m.user.displayName}>
                        <UserAvatar user={m.user} class="ring-2 ring-card" />
                      </li>
                    )}
                  </For>
                </ul>
                <p class="mt-2 text-sm text-muted-foreground">
                  {i().members.length === 1
                    ? `${ownerName()} so far`
                    : `${i().members.length} going`}
                </p>

                <div class="mt-6 flex flex-col gap-2">
                  <Switch>
                    <Match when={i().alreadyMember}>
                      <p class="text-sm">You're on this trip.</p>
                      <Button as={A} href={`/trips/${encodeURIComponent(i().tripId)}`}>
                        Open the trip
                      </Button>
                    </Match>
                    <Match when={!i().joinable}>
                      <p class="text-sm text-muted-foreground">
                        This invite has expired. Ask {ownerName()} for a new link.
                      </p>
                    </Match>
                    <Match when={!isAuthenticated()}>
                      <Button onClick={() => signIn("signup")}>Join Loci and the trip</Button>
                      <Button variant="ghost" onClick={() => signIn("signin")}>
                        I already have an account
                      </Button>
                    </Match>
                    <Match when={true}>
                      <Button disabled={accept.isPending} onClick={join}>
                        {accept.isPending ? "Joining…" : "Join trip"}
                      </Button>
                    </Match>
                  </Switch>
                  <Show when={accept.isError}>
                    <p class="text-sm text-destructive" role="alert">
                      Couldn't join the trip. The invite may have just expired.
                    </p>
                  </Show>
                </div>
              </>
            )}
          </Match>
        </Switch>
      </section>
    </main>
  );
}
