import { Match, Show, Switch } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { Loader2 } from "lucide-solid";
import { Button } from "~/ui/button";
import UserAvatar from "~/components/social/UserAvatar";
import { useAuth } from "~/contexts/AuthContext";
import { profilePath, useAcceptInvite, useInvite } from "~/lib/api/social";
import { capture } from "~/lib/analytics";

/**
 * Someone's invite link. Signed out, it asks you to join first and brings
 * you back here; signed in, one tap makes you friends.
 */
export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const inviteQuery = useInvite(() => params.code);
  const accept = useAcceptInvite();
  const data = () => (inviteQuery.isSuccess ? inviteQuery.data : undefined);
  const inviter = () => data()?.invite?.inviter;
  const here = () => `/invite/${encodeURIComponent(params.code)}`;

  const join = (to: "signup" | "signin") => {
    try {
      sessionStorage.setItem("auth_return_to", here());
    } catch {
      /* storage disabled: they land on the dashboard instead */
    }
    navigate(
      to === "signup" ? "/auth/signup" : `/auth/signin?returnTo=${encodeURIComponent(here())}`,
    );
  };

  const acceptInvite = () =>
    accept.mutate(params.code, {
      onSuccess: (friend) => {
        capture("friend_added", { via: "invite" });
        navigate((friend && profilePath(friend)) || "/friends");
      },
    });

  return (
    <main class="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 py-12">
      <Title>{`${inviter()?.displayName ?? "A friend"} invited you · Loci`}</Title>
      <Meta name="robots" content="noindex" />
      <section class="loci-card w-full p-8 text-center">
        <Switch>
          <Match when={inviteQuery.isLoading}>
            <Loader2
              class="mx-auto h-6 w-6 animate-spin text-muted-foreground"
              aria-label="Loading invite"
            />
          </Match>
          <Match when={inviteQuery.isError || (data() && !inviter())}>
            <h1 class="text-2xl">This invite has expired</h1>
            <p class="mt-2 text-muted-foreground">Ask your friend for a new link.</p>
            <Button as={A} href="/" class="mt-6">
              Go home
            </Button>
          </Match>
          <Match when={inviter()}>
            {(u) => (
              <>
                <UserAvatar user={u()} size="lg" class="mx-auto" />
                <h1 class="mt-4 text-2xl">{u().displayName} wants to travel with you</h1>
                <p class="mt-2 text-muted-foreground">
                  Friends on Loci see each other's shared trips and can copy them.
                </p>
                <div class="mt-6 flex flex-col gap-2">
                  <Switch>
                    <Match when={data()?.relationship === "friends"}>
                      <p class="text-sm">You're already friends.</p>
                      <Button as={A} href={profilePath(u()) ?? "/friends"}>
                        See their trips
                      </Button>
                    </Match>
                    <Match when={data()?.relationship === "self"}>
                      <p class="text-sm">This is your own invite. Send it to a friend.</p>
                      <Button as={A} href="/friends?tab=add">
                        Back to friends
                      </Button>
                    </Match>
                    <Match when={!isAuthenticated()}>
                      <Button onClick={() => join("signup")}>Join Loci and connect</Button>
                      <Button variant="ghost" onClick={() => join("signin")}>
                        I already have an account
                      </Button>
                    </Match>
                    <Match when={true}>
                      <Button disabled={accept.isPending} onClick={acceptInvite}>
                        {accept.isPending
                          ? "Connecting…"
                          : `Become friends with ${u().displayName}`}
                      </Button>
                    </Match>
                  </Switch>
                  <Show when={accept.isError}>
                    <p class="text-sm text-destructive" role="alert">
                      Couldn't accept the invite. It may have just expired.
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
