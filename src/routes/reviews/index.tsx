import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Star } from "lucide-solid";
import { useAuth } from "~/contexts/AuthContext";
import {
  fetchUserReviewsPage,
  useDeleteReview,
  useUpdateReview,
  useUserReviews,
  type ReviewItem,
  type ReviewWrite,
} from "~/lib/api/reviews";
import { breakdownShares, mineSummary, visitDayFromISO } from "~/lib/reviews/model";
import { canReview, reviewErrorMessage } from "~/lib/reviews/wire";
import { capture } from "~/lib/analytics";
import { Button } from "~/ui/button";
import ReviewCard from "~/components/ReviewCard";
import ReviewForm from "~/components/ReviewForm";
import { ErrorView } from "~/components/ErrorView";

/**
 * My reviews: what you wrote, newest first, each linking to its place, with
 * edit and delete. Reviews of a place live on the place (see PlaceReviews).
 * The summary is the server's UserReviewStatistics when it sends them, and
 * is worked out from the loaded rows on servers that leave them empty.
 */
export default function MyReviewsPage() {
  const { isAuthenticated } = useAuth();
  const mine = useUserReviews(() => isAuthenticated());
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();

  const [editing, setEditing] = createSignal<ReviewItem | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const [more, setMore] = createSignal<ReviewItem[]>([]);
  const [nextPage, setNextPage] = createSignal(2);
  const [hasMore, setHasMore] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  createEffect(
    on(
      () => mine.data,
      (page) => {
        setMore([]);
        setNextPage(2);
        setHasMore(page?.hasMore ?? false);
      },
    ),
  );

  const rows = createMemo(() => {
    const first = mine.isSuccess ? (mine.data?.reviews ?? []) : [];
    const seen = new Set<string>();
    return [...first, ...more()].filter((r) => !seen.has(r.id) && !!seen.add(r.id));
  });
  const sorted = createMemo(() =>
    [...rows()].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
  );
  const summary = createMemo(() => mineSummary(mine.data?.summary, rows()));
  const shares = createMemo(() => breakdownShares(summary().distribution));

  const loadMore = async () => {
    if (loadingMore()) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchUserReviewsPage(nextPage());
      setMore([...more(), ...page.reviews]);
      setNextPage(page.page + 1);
      setHasMore(page.hasMore);
    } catch (e) {
      setError(reviewErrorMessage(e, "We couldn't load more of your reviews."));
    } finally {
      setLoadingMore(false);
    }
  };

  const save = async (values: ReviewWrite) => {
    const target = editing();
    if (!target) return;
    setError(null);
    try {
      await updateReview.mutateAsync({ reviewId: target.id, ...values });
      capture("review_submitted", { rating: values.rating, is_edit: true });
      setEditing(null);
    } catch (e) {
      setError(reviewErrorMessage(e, "We couldn't save your review."));
    }
  };

  const remove = async (r: ReviewItem) => {
    if (!window.confirm(`Delete your review of ${r.poiName || "this place"}?`)) return;
    setError(null);
    try {
      await deleteReview.mutateAsync(r.id);
      setEditing(null);
    } catch (e) {
      setError(reviewErrorMessage(e, "We couldn't delete your review."));
    }
  };

  return (
    <main class="mx-auto max-w-3xl px-4 py-8">
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-foreground">My reviews</h1>
        <Show when={summary().count > 0}>
          <p class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {summary().count} review{summary().count === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span class="inline-flex items-center gap-1">
              <Star class="h-4 w-4 fill-current text-yellow-500" aria-hidden="true" />
              {summary().averageGiven.toFixed(1)} average given
            </span>
            <Show when={summary().helpfulReceived > 0}>
              <span>·</span>
              <span>
                {summary().helpfulReceived} helpful vote
                {summary().helpfulReceived === 1 ? "" : "s"}
              </span>
            </Show>
          </p>
          <ul class="mt-4 max-w-sm space-y-1" aria-label="Stars you gave">
            <For each={[5, 4, 3, 2, 1] as const}>
              {(star) => (
                <li class="flex items-center gap-2 text-xs text-muted-foreground">
                  <span class="w-8">{star} ★</span>
                  <span class="h-2 flex-1 overflow-hidden rounded bg-muted">
                    <span
                      class="block h-full bg-yellow-500"
                      style={{ width: `${shares()[star]}%` }}
                    />
                  </span>
                  <span class="w-8 text-right tabular-nums">{summary().distribution[star]}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </header>

      <Show when={!isAuthenticated()}>
        <p class="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <A href="/auth/signin?returnTo=/reviews" class="font-medium text-primary hover:underline">
            Sign in
          </A>{" "}
          to see the reviews you wrote.
        </p>
      </Show>

      <Show when={error() && !editing()}>
        <p role="alert" class="mb-4 text-sm text-destructive">
          {error()}
        </p>
      </Show>

      <Show when={mine.isError}>
        <ErrorView error={mine.error} onRetry={() => void mine.refetch()} />
      </Show>

      <Show when={isAuthenticated() && mine.isSuccess && sorted().length === 0}>
        <p class="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          You haven't reviewed a place yet. Open a place you've been to and tell the next traveller.
        </p>
      </Show>

      <div class="space-y-4">
        <For each={sorted()}>
          {(r) => (
            <ReviewCard
              review={r}
              showPlace
              placeHref={canReview(r.poiId) ? `/places/${r.poiId}` : undefined}
              mine
              onEdit={(review) => {
                setError(null);
                setEditing(review);
              }}
              onDelete={(review) => void remove(review)}
            />
          )}
        </For>
      </div>

      <Show when={hasMore()}>
        <div class="mt-6 flex justify-center">
          <Button variant="secondary" onClick={() => void loadMore()} disabled={loadingMore()}>
            {loadingMore() ? "Loading…" : "Load more"}
          </Button>
        </div>
      </Show>

      <Show when={editing()}>
        {(target) => (
          <ReviewForm
            poiName={target().poiName}
            initial={{
              rating: target().rating,
              title: target().title,
              content: target().content,
              visitDate: visitDayFromISO(target().visitDate),
            }}
            isEdit
            isSubmitting={updateReview.isPending || deleteReview.isPending}
            error={error()}
            onSubmit={(values) => void save(values)}
            onCancel={() => {
              setEditing(null);
              setError(null);
            }}
            onDelete={() => void remove(target())}
          />
        )}
      </Show>
    </main>
  );
}
