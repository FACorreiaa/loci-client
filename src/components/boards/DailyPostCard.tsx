import { Show } from "solid-js";
import { A } from "@solidjs/router";
import { DAILY_BOARD_SLUG, useDailyPost } from "~/lib/api/boards";
import AiBadge from "./AiBadge";
import AttachmentCard from "./AttachmentCard";

/**
 * Today's AI-written destination, pinned above the all-boards feed. Renders
 * nothing while loading, on error, when the board is empty or once it is stale.
 */
export default function DailyPostCard() {
  const daily = useDailyPost();

  return (
    <Show when={daily()}>
      {(p) => {
        const href = () => `/boards/${DAILY_BOARD_SLUG}/${p().id}`;
        return (
          <article class="loci-card mb-4 space-y-3 p-4">
            <p class="flex flex-wrap items-center gap-2">
              <span class="font-coord text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Today's destination
              </span>
              <Show when={p().isAiGenerated}>
                <AiBadge />
              </Show>
            </p>
            <h2 class="text-xl leading-tight">
              <A href={href()} class="hover:underline">
                {p().title}
              </A>
            </h2>
            <Show when={p().body}>
              <p class="line-clamp-3 text-sm text-muted-foreground">{p().body}</p>
            </Show>
            <Show when={p().attachment}>{(a) => <AttachmentCard attachment={a()} />}</Show>
          </article>
        );
      }}
    </Show>
  );
}
