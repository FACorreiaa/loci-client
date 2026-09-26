import { Show } from "solid-js";
import { useFriendRequests } from "~/lib/api/social";
import { useAuthGate } from "~/lib/auth/useAuthGate";

/** How many friend requests are waiting on you, next to the Friends link. */
export default function FriendRequestBadge() {
  const gate = useAuthGate();
  const incoming = useFriendRequests("incoming", () => gate());
  const count = () => (incoming.isSuccess ? incoming.data?.length : 0) ?? 0;
  return (
    <Show when={count() > 0}>
      <span
        class="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-accent-foreground"
        aria-label={`${count()} pending friend request${count() === 1 ? "" : "s"}`}
      >
        {count() > 9 ? "9+" : count()}
      </span>
    </Show>
  );
}
