import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import UserAvatar from "~/components/social/UserAvatar";
import { profilePath } from "~/lib/api/social";
import { timeAgo } from "~/lib/news/ticker";
import { boardsErrorMessage, useDeleteComment, type CommentNode } from "~/lib/api/boards";
import { showToast } from "~/lib/toast-store";
import { cn } from "~/lib/utils";
import CommentComposer from "./CommentComposer";
import ModerationMenu from "./ModerationMenu";
import type { SanctionTarget } from "./SanctionDialog";
import { confirmDelete, type BoardsSession } from "./session";

/** Past this depth replies stop indenting, so deep threads stay readable on a phone. */
const MAX_INDENT = 4;

interface TreeProps {
  nodes: CommentNode[];
  postId: string;
  session: BoardsSession;
  onSanction: (t: SanctionTarget) => void;
  depth?: number;
}

export default function CommentTree(props: TreeProps) {
  return (
    <ul class="space-y-3">
      <For each={props.nodes}>{(node) => <CommentItem {...props} node={node} />}</For>
    </ul>
  );
}

function CommentItem(props: TreeProps & { node: CommentNode }) {
  const c = () => props.node.comment;
  const depth = () => props.depth ?? 0;
  const mine = () => !!props.session.myId() && c().author?.id === props.session.myId();
  const [replying, setReplying] = createSignal(false);
  const del = useDeleteComment();

  const onDelete = () =>
    confirmDelete("comment", () =>
      del.mutate(c().id, {
        onError: (err) => showToast({ id: "boards-delete", title: boardsErrorMessage(err) }),
      }),
    );

  return (
    <li>
      <div class="flex gap-2">
        <div class="min-w-0 flex-1">
          <p class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <Show when={c().author} fallback={<span>[deleted]</span>}>
              {(a) => (
                <A
                  href={profilePath(a()) ?? "#"}
                  class="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                >
                  <UserAvatar user={a()} size="sm" class="h-5 w-5 text-[9px]" />
                  {a().displayName}
                </A>
              )}
            </Show>
            <time dateTime={c().createdAt}>{timeAgo(c().createdAt, new Date())}</time>
          </p>
          <Show when={!c().deleted}>
            <p class="mt-1 whitespace-pre-wrap break-words text-sm">{c().body}</p>
            <button
              type="button"
              class="mt-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setReplying(!replying())}
            >
              Reply
            </button>
          </Show>
        </div>
        <Show when={!c().deleted}>
          <ModerationMenu
            label="Comment actions"
            canDelete={mine() || props.session.isAdmin()}
            canModerate={props.session.isAdmin() && !mine() && !!c().author}
            onDelete={onDelete}
            onSanction={(kind) => c().author && props.onSanction({ user: c().author!, kind })}
          />
        </Show>
      </div>

      <Show when={replying()}>
        <div class="mt-2">
          <CommentComposer
            postId={props.postId}
            parentId={c().id}
            session={props.session}
            autofocus
            onDone={() => setReplying(false)}
          />
        </div>
      </Show>

      <Show when={props.node.children.length}>
        <div class={cn("mt-3", depth() < MAX_INDENT && "border-l-2 border-border/70 pl-3 sm:pl-4")}>
          <CommentTree {...props} nodes={props.node.children} depth={depth() + 1} />
        </div>
      </Show>
    </li>
  );
}
