import { createMemo, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Star } from "lucide-solid";
import { useAuth } from "~/contexts/AuthContext";
import {
  useDeleteReview,
  useUpdateReview,
  useUserReviews,
  type ReviewItem,
  type ReviewWrite,
} from "~/lib/api/reviews";
import { summariseMine } from "~/lib/reviews/model";
import { capture } from "~/lib/analytics";
import ReviewCard from "~/components/ReviewCard";
import ReviewForm from "~/components/ReviewForm";
import { ErrorView } from "~/components/ErrorView";

/**
 * My reviews: what you wrote, newest first, with edit and delete. Reviews of
 * a place live on the place (see PlaceReviews); the mock feed, the fake
 * "Places to review", the hard-coded counts and the travel-type filter that
 * used to be here are gone.
 */
export default function MyReviewsPage() {
  const { isAuthenticated } = useAuth();
  const mine = useUserReviews();
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();

  const [editing, setEditing] = createSignal<ReviewItem | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const rows = () => (mine.isSuccess ? (mine.data ?? []) : []);
  const sorted = createMemo(() =>
    [...rows()].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
  );
  const summary = createMemo(() => summariseMine(rows()));

  const save = async (values: ReviewWrite) => {
    const target = editing();
    if (!target) return;
    setError(null);
    try {
      await updateReview.mutateAsync({ reviewId: target.id, ...values });
      capture("review_submitted", { rating: values.rating, is_edit: true });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't save your review.");
    }
  };

  const remove = async (r: ReviewItem) => {
    if (!window.confirm(`Delete your review of ${r.poiName || "this place"}?`)) return;
    setError(null);
    try {
      await deleteReview.mutateAsync(r.id);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't delete your review.");
    }
  };

  return (
    <main class="mx-auto max-w-3xl px-4 py-8">
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-foreground">My reviews</h1>
        <Show when={summary().count > 0}>
          <p class="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
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
              <span>{summary().helpfulReceived} helpful votes</span>
            </Show>
          </p>
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

      <Show when={error()}>
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
              mine
              onEdit={setEditing}
              onDelete={(review) => void remove(review)}
            />
          )}
        </For>
      </div>

      <ReviewForm
        isOpen={editing() !== null}
        poiName={editing()?.poiName}
        initial={
          editing()
            ? {
                rating: editing()!.rating,
                title: editing()!.title,
                content: editing()!.content,
                visitDate: editing()!.visitDate?.split("T")[0] ?? "",
              }
            : undefined
        }
        isSubmitting={updateReview.isPending}
        error={error()}
        onSubmit={(values) => void save(values)}
        onCancel={() => {
          setEditing(null);
          setError(null);
        }}
      />
    </main>
  );
}
