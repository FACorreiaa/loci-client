import { createMemo, createSignal, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { ExternalLink } from "lucide-solid";
import { Button } from "~/ui/button";
import Markdown from "~/components/ui/Markdown";
import UserAvatar from "~/components/social/UserAvatar";
import AttachmentCard from "~/components/boards/AttachmentCard";
import CommentComposer from "~/components/boards/CommentComposer";
import CommentTree from "~/components/boards/CommentTree";
import ModerationMenu from "~/components/boards/ModerationMenu";
import SanctionBanner from "~/components/boards/SanctionBanner";
import SanctionDialog, { type SanctionTarget } from "~/components/boards/SanctionDialog";
import VoteControl from "~/components/boards/VoteControl";
import { confirmDelete, useBoardsSession } from "~/components/boards/session";
import { boardsErrorMessage, buildCommentTree, useDeletePost, usePost } from "~/lib/api/boards";
import { profilePath } from "~/lib/api/social";
import { timeAgo } from "~/lib/news/ticker";
import { showToast } from "~/lib/toast-store";

export default function PostPage() {
  const params = useParams<{ slug: string; postId: string }>();
  const navigate = useNavigate();
  const session = useBoardsSession();
  const postQuery = usePost(() => params.postId);
  const data = () => (postQuery.isSuccess ? postQuery.data : undefined);
  const tree = createMemo(() => buildCommentTree(data()?.comments ?? []));
  const [target, setTarget] = createSignal<SanctionTarget>();
  const del = useDeletePost();
  const boardHref = () => `/boards/${encodeURIComponent(params.slug)}`;

  return (
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Title>{`${data()?.post?.title ?? "Post"} · Boards · Loci`}</Title>
      <A href={boardHref()} class="text-sm text-muted-foreground hover:text-foreground">
        ← {data()?.post?.board.name || params.slug}
      </A>

      <Show when={postQuery.isError}>
        <section class="loci-card mx-auto mt-6 max-w-lg p-8 text-center">
          <h1 class="text-2xl">This post isn't here</h1>
          <p class="mt-2 text-muted-foreground">It may have been deleted.</p>
          <Button as={A} href={boardHref()} class="mt-6">
            Back to the board
          </Button>
        </section>
      </Show>

      <Show when={data()?.post}>
        {(p) => {
          const mine = () => !!session.myId() && p().author?.id === session.myId();
          return (
            <>
              <article class="loci-card mt-3 flex gap-3 p-4 sm:p-6">
                <VoteControl
                  postId={p().id}
                  score={p().score}
                  myVote={p().myVote}
                  signedIn={session.signedIn()}
                />
                <div class="min-w-0 flex-1 space-y-3">
                  <div class="flex items-start gap-2">
                    <h1 class="min-w-0 flex-1 text-2xl leading-tight">{p().title}</h1>
                    <ModerationMenu
                      label="Post actions"
                      canDelete={mine() || session.isAdmin()}
                      canModerate={session.isAdmin() && !mine() && !!p().author}
                      onDelete={() =>
                        confirmDelete("post", () =>
                          del.mutate(p().id, {
                            onSuccess: () => navigate(boardHref()),
                            onError: (err) =>
                              showToast({ id: "boards-delete", title: boardsErrorMessage(err) }),
                          }),
                        )
                      }
                      onSanction={(kind) => p().author && setTarget({ user: p().author!, kind })}
                    />
                  </div>
                  <p class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
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
                  </p>
                  <Show when={p().url}>
                    <a
                      href={p().url}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                      class="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {p().domain || p().url}
                      <ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </Show>
                  <Show when={p().body}>
                    <Markdown text={p().body} class="text-[15px]" />
                  </Show>
                  <Show when={p().attachment}>{(a) => <AttachmentCard attachment={a()} />}</Show>
                </div>
              </article>

              <section class="mt-8">
                <h2 class="mb-4 text-lg font-medium">
                  {p().commentCount} {p().commentCount === 1 ? "comment" : "comments"}
                </h2>
                <SanctionBanner sanction={session.sanction()} />
                <CommentComposer postId={p().id} session={session} />
                <div class="mt-6">
                  <CommentTree
                    nodes={tree()}
                    postId={p().id}
                    session={session}
                    onSanction={setTarget}
                  />
                </div>
              </section>
            </>
          );
        }}
      </Show>

      <SanctionDialog target={target()} onClose={() => setTarget(undefined)} />
    </main>
  );
}
