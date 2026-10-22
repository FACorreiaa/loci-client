import { createSignal, Match, Switch } from "solid-js";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { UserCheck, UserPlus, Users } from "lucide-solid";
import { Button } from "~/ui/button";
import {
  isFriend,
  useFollow,
  useUnblockUser,
  useUnfollow,
  type Edge,
  type PublicUser,
} from "~/lib/api/social";
import { useAuthGate } from "~/lib/auth/useAuthGate";
import { capture } from "~/lib/analytics";

/**
 * The one control for "do I follow this person". Following someone who
 * follows you makes you friends; a private account answers with a request.
 * Unfollowing asks once more, since a friend loses your friends-only trips.
 */
export default function FollowButton(props: {
  user: PublicUser;
  edge: Edge;
  size?: "sm" | "default";
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const gate = useAuthGate();
  const follow = useFollow();
  const unfollow = useUnfollow();
  const unblock = useUnblockUser();
  const [confirm, setConfirm] = createSignal(false);
  // Signed out, whatever the server said, the only move is to sign in.
  const state = () => (gate() ? props.edge.state : "unknown");
  const busy = () => follow.isPending || unfollow.isPending || unblock.isPending;

  const doFollow = () =>
    follow.mutate(props.user.id, {
      onSuccess: (e) =>
        capture("follow", { state: e.state, friends: isFriend(e), back: props.edge.followsYou }),
    });

  return (
    <Switch>
      <Match when={state() === "unknown"}>
        <Button
          size={props.size}
          class="gap-1.5"
          onClick={() => navigate(`/auth/signin?returnTo=${encodeURIComponent(location.pathname)}`)}
        >
          <UserPlus class="h-4 w-4" aria-hidden="true" />
          Sign in to follow
        </Button>
      </Match>
      <Match when={state() === "none"}>
        <Button size={props.size} class="gap-1.5" disabled={busy()} onClick={doFollow}>
          <UserPlus class="h-4 w-4" aria-hidden="true" />
          {props.edge.followsYou ? "Follow back" : "Follow"}
        </Button>
      </Match>
      <Match when={state() === "requested"}>
        <Button
          size={props.size}
          variant="outline"
          disabled={busy()}
          onClick={() => unfollow.mutate(props.user.id)}
          aria-label={`Requested. Cancel your request to follow ${props.user.displayName}`}
        >
          Requested
        </Button>
      </Match>
      <Match when={state() === "following"}>
        <Button
          size={props.size}
          variant={confirm() ? "destructive" : "outline"}
          class="gap-1.5"
          disabled={busy()}
          onClick={() =>
            confirm()
              ? unfollow.mutate(props.user.id, { onSettled: () => setConfirm(false) })
              : setConfirm(true)
          }
          onBlur={() => setConfirm(false)}
        >
          {props.edge.followsYou ? (
            <Users class="h-4 w-4" aria-hidden="true" />
          ) : (
            <UserCheck class="h-4 w-4" aria-hidden="true" />
          )}
          {confirm() ? "Unfollow?" : props.edge.followsYou ? "Friends" : "Following"}
        </Button>
      </Match>
      <Match when={state() === "blocked"}>
        <Button
          size={props.size}
          variant="outline"
          disabled={busy()}
          onClick={() => unblock.mutate(props.user.id)}
        >
          Unblock
        </Button>
      </Match>
      <Match when={state() === "self"}>
        <Button as={A} href="/settings" size={props.size} variant="outline">
          Edit profile
        </Button>
      </Match>
    </Switch>
  );
}
