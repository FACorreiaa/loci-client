import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { Star } from "lucide-solid";
import { useAuth } from "~/contexts/AuthContext";
import {
  fetchMyPOIReview,
  fetchPOIReviewsPage,
  useCreateReview,
  useDeleteReview,
  useLikeReview,
  useMyPOIReview,
  usePOIReviews,
  useReportReview,
  useReviewStatistics,
  useUpdateReview,
  type ReviewItem,
  type ReviewWrite,
} from "~/lib/api/reviews";
import {
  beginVote,
  breakdownShares,
  ratingTone,
  rollbackVote,
  settleVote,
  shownVote,
  visitDayFromISO,
  type ReportReason,
  type ShownVote,
} from "~/lib/reviews/model";
import { isAlreadyExists, reviewErrorMessage } from "~/lib/reviews/wire";
import { capture } from "~/lib/analytics";
import { Button } from "~/ui/button";
import ReviewCard from "~/components/ReviewCard";
import ReviewForm from "~/components/ReviewForm";
import { ErrorView } from "~/components/ErrorView";

export interface PlaceReviewsProps {
  /** A stored place's UUID; the caller only mounts this for one. */
  poiId: string;
  poiName: string;
}

const PREVIEW = 3;

const toneClass: Record<ReturnType<typeof ratingTone>, string> = {
  high: "text-green-600 dark:text-green-400",
  middle: "text-amber-600 dark:text-amber-400",
  low: "text-red-600 dark:text-red-400",
};

interface Composer {
  /** The review being edited; undefined while writing a new one. */
  target?: ReviewItem;
  initial?: ReviewWrite;
  notice?: string;
}

const toWrite = (r: ReviewItem): ReviewWrite => ({
  rating: r.rating,
  title: r.title,
  content: r.content,
  visitDate: visitDayFromISO(r.visitDate),
});

/**
 * A place's reviews: the summary and breakdown, the latest three with See
 * all (paged), Write or Edit your review, Helpful that toggles from the
 * server's voted_by_me, Report, and Delete for your own. The same shape as
 * loci-ios PlaceReviewsSection; the server is the only source, so a failed
 * write says so instead of pretending.
 */
export default function PlaceReviews(props: PlaceReviewsProps) {
  const { isAuthenticated, user } = useAuth();
  const reviews = usePOIReviews(() => props.poiId);
  const stats = useReviewStatistics(() => props.poiId);
  const mine = useMyPOIReview(
    () => props.poiId,
    () => isAuthenticated(),
  );
  const createReview = useCreateReview();
  const updateReview = useUpdateReview();
  const likeReview = useLikeReview();
  const reportReview = useReportReview();
  const deleteReview = useDeleteReview();

  const [showAll, setShowAll] = createSignal(false);
  const [composer, setComposer] = createSignal<Composer | null>(null);
  const [writeError, setWriteError] = createSignal<string | null>(null);
  const [votes, setVotes] = createSignal<Record<string, ShownVote>>({});

  // "See all" pages beyond the first, reset whenever the first page refetches
  // (a write invalidates it, and the later pages may have shifted).
  const [more, setMore] = createSignal<ReviewItem[]>([]);
  const [nextPage, setNextPage] = createSignal(2);
  const [hasMore, setHasMore] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [moreError, setMoreError] = createSignal<string | null>(null);
  createEffect(
    on(
      () => reviews.data,
      (page) => {
        setMore([]);
        setNextPage(2);
        setHasMore(page?.hasMore ?? false);
        setMoreError(null);
      },
    ),
  );

  const firstPage = () => (reviews.isSuccess ? (reviews.data?.reviews ?? []) : []);
  const list = createMemo(() => {
    const seen = new Set<string>();
    return [...firstPage(), ...more()].filter((r) => !seen.has(r.id) && !!seen.add(r.id));
  });
  const shown = () => (showAll() ? list() : list().slice(0, PREVIEW));
  const summary = () => (stats.isSuccess ? stats.data : undefined);
  const shares = createMemo(() => (summary() ? breakdownShares(summary()!.breakdown) : undefined));
  const myReview = () => (mine.isSuccess ? (mine.data ?? undefined) : undefined);
  const isMine = (r: ReviewItem) =>
    r.id === myReview()?.id || (!!user()?.id && r.userId === user()!.id);
  const voteOf = (r: ReviewItem) => shownVote(r, votes()[r.id]);
  const setVote = (id: string, v: ShownVote) => setVotes({ ...votes(), [id]: v });

  const loadMore = async () => {
    if (loadingMore()) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await fetchPOIReviewsPage(props.poiId, nextPage());
      setMore([...more(), ...page.reviews]);
      setNextPage(page.page + 1);
      setHasMore(page.hasMore);
    } catch (error) {
      setMoreError(reviewErrorMessage(error, "We couldn't load more reviews."));
    } finally {
      setLoadingMore(false);
    }
  };

  const openComposer = () => {
    setWriteError(null);
    const existing = myReview();
    setComposer(existing ? { target: existing, initial: toWrite(existing) } : {});
  };

  const closeComposer = () => {
    setComposer(null);
    setWriteError(null);
  };

  const submit = async (values: ReviewWrite) => {
    setWriteError(null);
    const target = composer()?.target;
    try {
      if (target) await updateReview.mutateAsync({ reviewId: target.id, ...values });
      else await createReview.mutateAsync({ poiId: props.poiId, ...values });
      capture("review_submitted", { rating: values.rating, is_edit: Boolean(target) });
      closeComposer();
    } catch (error) {
      if (!target && isAlreadyExists(error)) {
        // A review of this place already exists (another tab, another device):
        // keep what was typed, switch to editing that review, and say so.
        try {
          const existing = await fetchMyPOIReview(props.poiId);
          if (existing) {
            setComposer({
              ...composer(),
              target: existing,
              notice: "You've already reviewed this place. Saving will update that review.",
            });
            void mine.refetch();
            return;
          }
        } catch {
          /* fall through to the message */
        }
      }
      setWriteError(reviewErrorMessage(error, "We couldn't save your review."));
    }
  };

  const helpful = async (r: ReviewItem) => {
    if (!isAuthenticated() || isMine(r)) return;
    const before = voteOf(r);
    const next = beginVote(before);
    if (!next) return;
    setVote(r.id, next);
    try {
      const count = await likeReview.mutateAsync({ reviewId: r.id, isLike: next.isLike });
      setVote(r.id, settleVote(next, count));
    } catch (error) {
      setVote(r.id, rollbackVote(before));
      setWriteError(reviewErrorMessage(error, "We couldn't record your vote."));
    }
  };

  const report = async (r: ReviewItem, reason: ReportReason) => {
    try {
      await reportReview.mutateAsync({ reviewId: r.id, reason });
    } catch (error) {
      throw new Error(reviewErrorMessage(error, "We couldn't send the report."), { cause: error });
    }
  };

  const remove = async (r: ReviewItem) => {
    if (!window.confirm("Delete your review?")) return;
    setWriteError(null);
    try {
      await deleteReview.mutateAsync(r.id);
      closeComposer();
    } catch (error) {
      setWriteError(reviewErrorMessage(error, "We couldn't delete your review."));
    }
  };

  return (
    <section class="space-y-4" aria-labelledby="reviews-heading">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="reviews-heading" class="text-lg font-semibold text-foreground">
            Reviews
          </h2>
          <Show when={summary() && summary()!.total > 0}>
            <p class="mt-1 flex items-center gap-2 text-sm">
              <Star
                class={`h-4 w-4 fill-current ${toneClass[ratingTone(summary()!.average)]}`}
                aria-hidden="true"
              />
              <span class={`font-semibold ${toneClass[ratingTone(summary()!.average)]}`}>
                {summary()!.average.toFixed(1)}
              </span>
              <span class="text-muted-foreground">
                · {summary()!.total} review{summary()!.total === 1 ? "" : "s"}
              </span>
            </p>
          </Show>
        </div>
        <Show when={isAuthenticated()}>
          <Button size="sm" onClick={openComposer} disabled={mine.isPending}>
            {myReview() ? "Edit your review" : "Write a review"}
          </Button>
        </Show>
      </div>

      <Show when={summary() && summary()!.total > 0 && shares()}>
        <ul class="space-y-1" aria-label="Rating breakdown">
          <For each={[5, 4, 3, 2, 1] as const}>
            {(star) => (
              <li class="flex items-center gap-2 text-xs text-muted-foreground">
                <span class="w-8">{star} ★</span>
                <span class="h-2 flex-1 overflow-hidden rounded bg-muted">
                  <span
                    class="block h-full bg-yellow-500"
                    style={{ width: `${shares()![star]}%` }}
                  />
                </span>
                <span class="w-8 text-right tabular-nums">{summary()!.breakdown[star]}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={writeError() && !composer()}>
        <p role="alert" class="text-sm text-destructive">
          {writeError()}
        </p>
      </Show>

      <Show when={reviews.isError}>
        <ErrorView error={reviews.error} onRetry={() => void reviews.refetch()} />
      </Show>

      <Show when={reviews.isSuccess && list().length === 0}>
        <p class="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No reviews yet.{" "}
          {isAuthenticated() ? "Be the first to write one." : "Sign in to write the first one."}
        </p>
      </Show>

      <For each={shown()}>
        {(r) => (
          <ReviewCard
            review={{ ...r, helpful: voteOf(r).helpful }}
            mine={isMine(r)}
            canInteract={isAuthenticated()}
            voted={voteOf(r).voted}
            votePending={voteOf(r).pending}
            onHelpful={(review) => void helpful(review)}
            onReport={report}
            onEdit={openComposer}
            onDelete={(review) => void remove(review)}
          />
        )}
      </For>

      <Show when={!showAll() && (list().length > PREVIEW || hasMore())}>
        <Button variant="secondary" size="sm" onClick={() => setShowAll(true)}>
          See all
          {summary() && summary()!.total > 0 ? ` ${summary()!.total}` : ""} reviews
        </Button>
      </Show>

      <Show when={showAll() && hasMore()}>
        <div class="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadMore()}
            disabled={loadingMore()}
          >
            {loadingMore() ? "Loading…" : "Load more"}
          </Button>
          <Show when={moreError()}>
            <p role="alert" class="text-sm text-destructive">
              {moreError()}
            </p>
          </Show>
        </div>
      </Show>

      <Show when={composer()}>
        {(c) => (
          <ReviewForm
            poiName={props.poiName}
            initial={c().initial}
            isEdit={Boolean(c().target)}
            notice={c().notice}
            isSubmitting={
              createReview.isPending || updateReview.isPending || deleteReview.isPending
            }
            error={writeError()}
            onSubmit={(values) => void submit(values)}
            onCancel={closeComposer}
            onDelete={c().target ? () => void remove(c().target!) : undefined}
          />
        )}
      </Show>
    </section>
  );
}
