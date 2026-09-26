import { createSignal, Match, Switch } from "solid-js";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { Check, UserCheck, UserPlus } from "lucide-solid";
import { Button } from "~/ui/button";
import {
  useCancelFriendRequest,
  useFriendRequests,
  useRemoveFriend,
  useSendFriendRequest,
  useUnblockUser,
  type PublicUser,
  type Relationship,
} from "~/lib/api/social";
import { useAuthGate } from "~/lib/auth/useAuthGate";
import { capture } from "~/lib/analytics";

/**
 * The one control for "what am I to this person". Accepting an incoming
 * request is the same call as sending one: the server turns crossing
 * requests into a friendship.
 */
export default function RelationshipButton(props: {
  user: PublicUser;
  relationship: Relationship;
  size?: "sm" | "default";
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const gate = useAuthGate();
  const send = useSendFriendRequest();
  const cancel = useCancelFriendRequest();
  const remove = useRemoveFriend();
  const unblock = useUnblockUser();
  const outgoing = useFriendRequests(
    "outgoing",
    () => gate() && props.relationship === "requested",
  );
  const [confirmRemove, setConfirmRemove] = createSignal(false);
  // Signed out, whatever the server said, the only move is to sign in.
  const relationship = (): Relationship => (gate() ? props.relationship : "unknown");

  const busy = () => send.isPending || cancel.isPending || remove.isPending || unblock.isPending;

  const add = () =>
    send.mutate(
      { userId: props.user.id },
      { onSuccess: (r) => r === "friends" && capture("friend_added", { via: "profile" }) },
    );

  const cancelRequest = () => {
    const pending = outgoing.isSuccess ? outgoing.data : undefined;
    const req = pending?.find((r) => r.to.id === props.user.id);
    if (req) cancel.mutate(req.id);
  };

  return (
    <Switch>
      <Match when={relationship() === "unknown"}>
        <Button
          size={props.size}
          class="gap-1.5"
          onClick={() => navigate(`/auth/signin?returnTo=${encodeURIComponent(location.pathname)}`)}
        >
          <UserPlus class="h-4 w-4" aria-hidden="true" />
          Sign in to add
        </Button>
      </Match>
      <Match when={relationship() === "none"}>
        <Button size={props.size} class="gap-1.5" disabled={busy()} onClick={add}>
          <UserPlus class="h-4 w-4" aria-hidden="true" />
          Add friend
        </Button>
      </Match>
      <Match when={relationship() === "incoming"}>
        <Button size={props.size} class="gap-1.5" disabled={busy()} onClick={add}>
          <Check class="h-4 w-4" aria-hidden="true" />
          Accept request
        </Button>
      </Match>
      <Match when={relationship() === "requested"}>
        <Button size={props.size} variant="outline" disabled={busy()} onClick={cancelRequest}>
          Requested · Cancel
        </Button>
      </Match>
      <Match when={relationship() === "friends"}>
        <Button
          size={props.size}
          variant={confirmRemove() ? "destructive" : "outline"}
          class="gap-1.5"
          disabled={busy()}
          onClick={() => (confirmRemove() ? remove.mutate(props.user.id) : setConfirmRemove(true))}
          onBlur={() => setConfirmRemove(false)}
        >
          <UserCheck class="h-4 w-4" aria-hidden="true" />
          {confirmRemove() ? "Remove friend?" : "Friends"}
        </Button>
      </Match>
      <Match when={relationship() === "blocked"}>
        <Button
          size={props.size}
          variant="outline"
          disabled={busy()}
          onClick={() => unblock.mutate(props.user.id)}
        >
          Unblock
        </Button>
      </Match>
      <Match when={relationship() === "self"}>
        <Button as={A} href="/settings" size={props.size} variant="outline">
          Edit profile
        </Button>
      </Match>
    </Switch>
  );
}
