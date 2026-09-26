import { Show } from "solid-js";
import { initials, type PublicUser } from "~/lib/api/social";
import { cn } from "~/lib/utils";

const SIZES = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-20 w-20 text-2xl" } as const;

/** A user's photo, or their initials on the brand tint when they have none. */
export default function UserAvatar(props: {
  user: Pick<PublicUser, "displayName" | "username" | "avatarUrl">;
  size?: keyof typeof SIZES;
  class?: string;
}) {
  return (
    <span
      class={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 font-semibold text-primary",
        SIZES[props.size ?? "md"],
        props.class,
      )}
    >
      <Show
        when={props.user.avatarUrl}
        fallback={<span aria-hidden="true">{initials(props.user)}</span>}
      >
        <img src={props.user.avatarUrl} alt="" class="h-full w-full object-cover" loading="lazy" />
      </Show>
    </span>
  );
}
