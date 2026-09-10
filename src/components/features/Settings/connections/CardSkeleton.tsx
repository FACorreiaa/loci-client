import { Skeleton } from "~/ui/skeleton";

/**
 * The shape of a card before its RPC answers.
 *
 * Each card on the page has its own Suspense boundary with this as the
 * fallback, so a slow or failing RPC for one card leaves the others readable
 * — the previous page swapped the whole route for a spinner instead.
 */
export function CardSkeleton() {
  return (
    <div class="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6" aria-busy="true">
      <div class="space-y-2">
        <Skeleton class="h-5 w-40" />
        <Skeleton class="h-4 w-full max-w-md" />
      </div>
      <Skeleton class="h-24 w-full" />
    </div>
  );
}
