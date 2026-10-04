import { Show } from "solid-js";
import { A } from "@solidjs/router";
import { MessageSquare, Paperclip } from "lucide-solid";
import UserAvatar from "~/components/social/UserAvatar";
import { profilePath } from "~/lib/api/social";
import { timeAgo } from "~/lib/news/ticker";
import type { Post } from "~/lib/api/boards";
import VoteControl from "./VoteControl";
import ModerationMenu from "./ModerationMenu";
import type { BoardsSession } from "./session";

export const postPath = (p: Pick<Post, "id" | "board">) =>
  `/boards/${encodeURIComponent(p.board.slug)}/${p.id}`;

/** One line of a feed: arrows, title and domain, then who, where and when. */
export default function PostRow(props: {
  post: Post;
  session: BoardsSession;
  showBoard: boolean;
  onDelete: (post: Post) => void;
  onSanction: (post: Post, kind: "mute" | "ban") => void;
}) {
  const p = () => props.post;
  const mine = () => !!props.session.myId() && p().author?.id === props.session.myId();

  return (
    <article class="flex gap-3 border-b border-border/60 px-2 py-3 last:border-b-0 sm:px-4">
      <VoteControl
        postId={p().id}
        score={p().score}
        myVote={p().myVote}
        signedIn={props.session.signedIn()}
      />
      <div class="min-w-0 flex-1">
        <h3 class="text-[15px] font-medium leading-snug">
          <A href={postPath(p())} class="hover:underline">
            {p().title}
          </A>
          <Show when={p().domain}>
            {" "}
            <a
              href={p().url}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              class="text-xs font-normal text-muted-foreground hover:underline"
            >
              ({p().domain})
            </a>
          </Show>
          <Show when={p().attachment}>
            <Paperclip
              class="ml-1 inline h-3.5 w-3.5 text-muted-foreground"
              aria-label="Has a Loci item attached"
            />
          </Show>
        </h3>
        <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Show when={props.showBoard && p().board.slug}>
            <A
              href={`/boards/${encodeURIComponent(p().board.slug)}`}
              class="rounded-full border border-border px-2 py-0.5 hover:text-foreground"
            >
              {p().board.name}
            </A>
          </Show>
          <Show when={p().author}>
            {(a) => (
              <A
                href={profilePath(a()) ?? "#"}
                class="inline-flex items-center gap-1 hover:text-foreground"
              >
                <UserAvatar user={a()} size="sm" class="h-5 w-5 text-[9px]" />
                {a().displayName}
              </A>
            )}
          </Show>
          <time dateTime={p().createdAt}>{timeAgo(p().createdAt, new Date())}</time>
          <A href={postPath(p())} class="inline-flex items-center gap-1 hover:text-foreground">
            <MessageSquare class="h-3.5 w-3.5" aria-hidden="true" />
            {p().commentCount}
            <span class="sr-only">comments</span>
          </A>
        </p>
      </div>
      <ModerationMenu
        label="Post actions"
        canDelete={mine() || props.session.isAdmin()}
        canModerate={props.session.isAdmin() && !mine() && !!p().author}
        onDelete={() => props.onDelete(p())}
        onSanction={(kind) => props.onSanction(p(), kind)}
      />
    </article>
  );
}
