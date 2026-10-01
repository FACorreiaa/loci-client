import { Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { PenLine, Trash2 } from "lucide-solid";
import { Button } from "~/ui/button";
import PostFeed from "~/components/boards/PostFeed";
import SanctionBanner from "~/components/boards/SanctionBanner";
import { confirmDelete, useBoardsSession } from "~/components/boards/session";
import { boardsErrorMessage, useBoard, useDeleteBoard } from "~/lib/api/boards";
import { profilePath } from "~/lib/api/social";
import { showToast } from "~/lib/toast-store";

export default function BoardPage() {
  const params = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const session = useBoardsSession();
  const boardQuery = useBoard(() => params.slug);
  const board = () => (boardQuery.isSuccess ? boardQuery.data : undefined);
  const del = useDeleteBoard();

  const onDelete = () =>
    confirmDelete("board and every post in it", () =>
      del.mutate(params.slug, {
        onSuccess: () => navigate("/boards"),
        onError: (err) => showToast({ id: "boards-delete", title: boardsErrorMessage(err) }),
      }),
    );

  return (
    <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Title>{`${board()?.name ?? params.slug} · Boards · Loci`}</Title>
      <Show when={board()?.description}>{(d) => <Meta name="description" content={d()} />}</Show>
      <A href="/boards" class="text-sm text-muted-foreground hover:text-foreground">
        ← Boards
      </A>

      <Show when={boardQuery.isError}>
        <section class="loci-card mx-auto mt-6 max-w-lg p-8 text-center">
          <h1 class="text-2xl">No board here</h1>
          <p class="mt-2 text-muted-foreground">
            It may have been closed, or the address is wrong.
          </p>
          <Button as={A} href="/boards" class="mt-6">
            All boards
          </Button>
        </section>
      </Show>

      <Show when={board()}>
        {(b) => (
          <>
            <header class="mb-6 mt-2 flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <h1 class="text-3xl">{b().name}</h1>
                <Show when={b().description}>
                  <p class="mt-1 text-muted-foreground">{b().description}</p>
                </Show>
                <p class="mt-1 text-xs text-muted-foreground">
                  /boards/{b().slug}
                  <Show when={b().createdBy}>
                    {(u) => (
                      <>
                        {" · opened by "}
                        <A href={profilePath(u()) ?? "#"} class="hover:underline">
                          {u().displayName}
                        </A>
                      </>
                    )}
                  </Show>
                </p>
              </div>
              <div class="flex gap-2">
                <Show when={session.isAdmin()}>
                  <Button variant="outline" size="sm" onClick={onDelete} disabled={del.isPending}>
                    <Trash2 class="mr-1 h-4 w-4" aria-hidden="true" />
                    Delete board
                  </Button>
                </Show>
                <Show when={!session.sanction()}>
                  <Button
                    as={A}
                    href={
                      session.signedIn()
                        ? `/boards/${encodeURIComponent(b().slug)}/submit`
                        : "/auth/signin"
                    }
                    size="sm"
                  >
                    <PenLine class="mr-1 h-4 w-4" aria-hidden="true" />
                    Post
                  </Button>
                </Show>
              </div>
            </header>

            <SanctionBanner sanction={session.sanction()} />

            <PostFeed slug={b().slug} session={session} empty="No posts here yet. Be the first." />
          </>
        )}
      </Show>
    </main>
  );
}
