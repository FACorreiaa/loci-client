import { For, Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { Plus, ShieldCheck } from "lucide-solid";
import { Button } from "~/ui/button";
import PostFeed from "~/components/boards/PostFeed";
import SanctionBanner from "~/components/boards/SanctionBanner";
import { useBoardsSession } from "~/components/boards/session";
import { useBoards } from "~/lib/api/boards";

/** Every board's posts in one feed, with the directory of boards beside it. */
export default function BoardsHome() {
  const session = useBoardsSession();
  const boardsQuery = useBoards();
  const boards = () => (boardsQuery.isSuccess ? boardsQuery.data : []);

  return (
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Title>Boards · Loci</Title>
      <Meta
        name="description"
        content="Travellers trading trip reports, itineraries and places on Loci."
      />

      <header class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-3xl">Boards</h1>
          <p class="mt-1 text-muted-foreground">
            Trip reports, itineraries worth stealing, and places people actually went.
          </p>
        </div>
        <div class="flex gap-2">
          <Show when={session.isAdmin()}>
            <Button as={A} href="/boards/admin" variant="outline" size="sm">
              <ShieldCheck class="mr-1 h-4 w-4" aria-hidden="true" />
              Moderation
            </Button>
          </Show>
          <Show when={session.signedIn() && !session.sanction()}>
            <Button as={A} href="/boards/new" size="sm">
              <Plus class="mr-1 h-4 w-4" aria-hidden="true" />
              New board
            </Button>
          </Show>
        </div>
      </header>

      <SanctionBanner sanction={session.sanction()} />

      <div class="grid gap-6 lg:grid-cols-[1fr_280px]">
        <PostFeed
          slug=""
          session={session}
          empty="Nothing posted yet. Open a board and start the first thread."
        />

        <aside class="order-first lg:order-none">
          <h2 class="font-coord mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            All boards
          </h2>
          <Show
            when={boards().length}
            fallback={
              <p class="text-sm text-muted-foreground">
                {boardsQuery.isLoading ? "Loading…" : "No boards yet."}
              </p>
            }
          >
            <ul class="loci-card divide-y divide-border/60 p-0">
              <For each={boards()}>
                {(b) => (
                  <li>
                    <A
                      href={`/boards/${encodeURIComponent(b.slug)}`}
                      class="block px-4 py-3 hover:bg-accent"
                    >
                      <span class="block font-medium">{b.name}</span>
                      <span class="text-xs text-muted-foreground">
                        {b.postCount} {b.postCount === 1 ? "post" : "posts"}
                      </span>
                    </A>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </aside>
      </div>
    </main>
  );
}
