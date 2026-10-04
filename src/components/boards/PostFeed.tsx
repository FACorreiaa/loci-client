import { createEffect, createSignal, For, on, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { Button } from "~/ui/button";
import {
  boardsErrorMessage,
  fetchPosts,
  useDeletePost,
  usePosts,
  type Post,
  type PostSortName,
  type TopWindowName,
} from "~/lib/api/boards";
import { showToast } from "~/lib/toast-store";
import { cn } from "~/lib/utils";
import PostRow from "./PostRow";
import SanctionDialog, { type SanctionTarget } from "./SanctionDialog";
import { confirmDelete, type BoardsSession } from "./session";

const WINDOWS: { value: TopWindowName; label: string }[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "all", label: "All time" },
];

const pill = (active: boolean) =>
  cn(
    "rounded-full px-3 py-1 text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
  );

/**
 * A board's posts, or every board's when slug is empty. New/Top and the Top
 * window live in the URL, so a sorted feed can be linked to.
 */
export default function PostFeed(props: { slug: string; session: BoardsSession; empty: string }) {
  const [params, setParams] = useSearchParams<{ sort?: string; t?: string }>();
  const sort = (): PostSortName => (params.sort === "top" ? "top" : "new");
  const topWindow = (): TopWindowName =>
    params.t === "day" || params.t === "all" ? params.t : "week";

  const query = usePosts(() => props.slug, sort, topWindow);
  const first = () => (query.isSuccess ? query.data : undefined);

  // Further pages are appended locally; a new first page resets them.
  const [more, setMore] = createSignal<Post[]>([]);
  const [cursor, setCursor] = createSignal("");
  const [loadingMore, setLoadingMore] = createSignal(false);
  createEffect(
    on(first, (page) => {
      setMore([]);
      setCursor(page?.nextCursor ?? "");
    }),
  );
  const posts = () => [...(first()?.posts ?? []), ...more()];

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchPosts(props.slug, sort(), topWindow(), cursor());
      const seen = new Set(posts().map((p) => p.id));
      setMore([...more(), ...page.posts.filter((p) => !seen.has(p.id))]);
      setCursor(page.nextCursor);
    } catch (err) {
      showToast({ id: "boards-feed", title: boardsErrorMessage(err) });
    } finally {
      setLoadingMore(false);
    }
  };

  const del = useDeletePost();
  const onDelete = (post: Post) =>
    confirmDelete("post", () =>
      del.mutate(post.id, {
        onError: (err) => showToast({ id: "boards-delete", title: boardsErrorMessage(err) }),
      }),
    );
  const [target, setTarget] = createSignal<SanctionTarget>();

  return (
    <section>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <div class="flex gap-1 rounded-full border border-border p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={sort() === "new"}
            class={pill(sort() === "new")}
            onClick={() => setParams({ sort: undefined, t: undefined })}
          >
            New
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sort() === "top"}
            class={pill(sort() === "top")}
            onClick={() => setParams({ sort: "top" })}
          >
            Top
          </button>
        </div>
        <Show when={sort() === "top"}>
          <div class="flex gap-1">
            <For each={WINDOWS}>
              {(w) => (
                <button
                  type="button"
                  class={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    topWindow() === w.value
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setParams({ t: w.value === "week" ? undefined : w.value })}
                >
                  {w.label}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="loci-card overflow-hidden p-0">
        <Show when={query.isError}>
          <p class="p-6 text-center text-sm text-muted-foreground">
            {boardsErrorMessage(query.error)}
          </p>
        </Show>
        <Show when={query.isLoading}>
          <p class="p-6 text-center text-sm text-muted-foreground">Loading…</p>
        </Show>
        <Show when={first() && posts().length === 0}>
          <p class="p-8 text-center text-sm text-muted-foreground">{props.empty}</p>
        </Show>
        <For each={posts()}>
          {(post) => (
            <PostRow
              post={post}
              session={props.session}
              showBoard={!props.slug}
              onDelete={onDelete}
              onSanction={(p, kind) => p.author && setTarget({ user: p.author, kind })}
            />
          )}
        </For>
      </div>

      <Show when={cursor()}>
        <div class="mt-4 flex justify-center">
          <Button variant="outline" size="sm" disabled={loadingMore()} onClick={loadMore}>
            {loadingMore() ? "Loading…" : "Load more"}
          </Button>
        </div>
      </Show>

      <SanctionDialog target={target()} onClose={() => setTarget(undefined)} />
    </section>
  );
}
