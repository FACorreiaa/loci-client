import { createMemo, createSignal, For, Show } from "solid-js";
import { Star } from "lucide-solid";
import { useAuth } from "~/contexts/AuthContext";
import {
  currentUserId,
  myReviewFor,
  useCreateReview,
  useDeleteReview,
  useLikeReview,
  usePOIReviews,
  useReviewStatistics,
  useUpdateReview,
  useUserReviews,
  type ReviewItem,
  type ReviewWrite,
} from "~/lib/api/reviews";
import { nextVote, ratingTone } from "~/lib/reviews/model";
import { readVotes, writeVotes } from "~/lib/reviews/votes";
import { capture } from "~/lib/analytics";
import { Button } from "~/ui/button";
import ReviewCard from "~/components/ReviewCard";
import ReviewForm from "~/components/ReviewForm";
import { ErrorView } from "~/components/ErrorView";

export interface PlaceReviewsProps {
  poiId: string;
  poiName: string;
}

const PREVIEW = 3;

const toneClass: Record<ReturnType<typeof ratingTone>, string> = {
  high: "text-green-600 dark:text-green-400",
  middle: "text-amber-600 dark:text-amber-400",
  low: "text-red-600 dark:text-red-400",
};

/**
 * A place's reviews: the summary and breakdown, the latest few with See all,
 * Write or Edit your review, Helpful that toggles, Delete for your own. The
 * same shape as loci-ios PlaceReviewsSection; the server is the only source,
 * so a failed write says so instead of pretending.
 */
export default function PlaceReviews(props: PlaceReviewsProps) {
  const { isAuthenticated } = useAuth();
  const reviews = usePOIReviews(() => props.poiId);
  const stats = useReviewStatistics(() => props.poiId);
  const mine = useUserReviews();
  const createReview = useCreateReview();
  const updateReview = useUpdateReview();
  const likeReview = useLikeReview();
  const deleteReview = useDeleteReview();

  const [showAll, setShowAll] = createSignal(false);
  const [composing, setComposing] = createSignal(false);
  const [writeError, setWriteError] = createSignal<string | null>(null);
  const [votes, setVotes] = createSignal(readVotes());
  const [optimisticHelpful, setOptimisticHelpful] = createSignal<Record<string, number>>({});

  const list = () => (reviews.isSuccess ? (reviews.data ?? []) : []);
  const shown = () => (showAll() ? list() : list().slice(0, PREVIEW));
  const summary = () => (stats.isSuccess ? stats.data : undefined);
  const myReview = createMemo(() =>
    mine.isSuccess ? myReviewFor(mine.data, props.poiId) : undefined,
  );
  const me = () => currentUserId();
  const isMine = (r: ReviewItem) => Boolean(me()) && r.userId === me();
  const helpfulOf = (r: ReviewItem) => optimisticHelpful()[r.id] ?? r.helpful;

  const submit = async (values: ReviewWrite) => {
    setWriteError(null);
    try {
      const existing = myReview();
      if (existing) await updateReview.mutateAsync({ reviewId: existing.id, ...values });
      else await createReview.mutateAsync({ poiId: props.poiId, ...values });
      capture("review_submitted", { rating: values.rating, is_edit: Boolean(existing) });
      setComposing(false);
    } catch (error) {
      setWriteError(
        error instanceof Error && error.message ? error.message : "We couldn't save your review.",
      );
    }
  };

  const helpful = async (r: ReviewItem) => {
    if (!isAuthenticated()) return;
    const next = nextVote({ voted: votes().has(r.id), helpful: helpfulOf(r) });
    const updated = new Set(votes());
    if (next.voted) updated.add(r.id);
    else updated.delete(r.id);
    setVotes(updated);
    writeVotes(updated);
    setOptimisticHelpful({ ...optimisticHelpful(), [r.id]: next.helpful });
    try {
      const count = await likeReview.mutateAsync({ reviewId: r.id, isLike: next.isLike });
      setOptimisticHelpful({ ...optimisticHelpful(), [r.id]: count });
    } catch {
      // Put the vote back: the server did not take it.
      const reverted = new Set(votes());
      if (next.voted) reverted.delete(r.id);
      else reverted.add(r.id);
      setVotes(reverted);
      writeVotes(reverted);
      setOptimisticHelpful({ ...optimisticHelpful(), [r.id]: r.helpful });
    }
  };

  const remove = async (r: ReviewItem) => {
    if (!window.confirm("Delete your review?")) return;
    try {
      await deleteReview.mutateAsync(r.id);
    } catch (error) {
      setWriteError(
        error instanceof Error && error.message ? error.message : "We couldn't delete your review.",
      );
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
          <Button size="sm" onClick={() => setComposing(true)}>
            {myReview() ? "Edit your review" : "Write a review"}
          </Button>
        </Show>
      </div>

      <Show when={summary() && summary()!.total > 0}>
        <ul class="space-y-1" aria-label="Rating breakdown">
          <For each={[5, 4, 3, 2, 1] as const}>
            {(star) => {
              const count = () => summary()!.breakdown[star];
              const pct = () =>
                summary()!.total ? Math.round((count() / summary()!.total) * 100) : 0;
              return (
                <li class="flex items-center gap-2 text-xs text-muted-foreground">
                  <span class="w-8">{star} ★</span>
                  <span class="h-2 flex-1 overflow-hidden rounded bg-muted">
                    <span class="block h-full bg-yellow-500" style={{ width: `${pct()}%` }} />
                  </span>
                  <span class="w-8 text-right">{count()}</span>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>

      <Show when={writeError() && !composing()}>
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
            review={{ ...r, helpful: helpfulOf(r) }}
            mine={isMine(r)}
            voted={votes().has(r.id)}
            onHelpful={(review) => void helpful(review)}
            onEdit={() => setComposing(true)}
            onDelete={(review) => void remove(review)}
          />
        )}
      </For>

      <Show when={!showAll() && list().length > PREVIEW}>
        <Button variant="secondary" size="sm" onClick={() => setShowAll(true)}>
          See all {list().length} reviews
        </Button>
      </Show>

      <ReviewForm
        isOpen={composing()}
        poiName={props.poiName}
        initial={
          myReview()
            ? {
                rating: myReview()!.rating,
                title: myReview()!.title,
                content: myReview()!.content,
                visitDate: myReview()!.visitDate?.split("T")[0] ?? "",
              }
            : undefined
        }
        isSubmitting={createReview.isPending || updateReview.isPending}
        error={writeError()}
        onSubmit={(values) => void submit(values)}
        onCancel={() => {
          setComposing(false);
          setWriteError(null);
        }}
      />
    </section>
  );
}
