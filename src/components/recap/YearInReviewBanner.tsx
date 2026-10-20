import { Show } from "solid-js";
import { A } from "@solidjs/router";
import { Sparkles } from "lucide-solid";
import { RecapStatus, useYearInReview } from "~/lib/api/recap";
import { yearInReviewYear } from "~/lib/recap/recap";

/**
 * "Your 2026 in Loci", once the year's recap is ready. It asks only in
 * December and January, so the rest of the year it costs nothing.
 */
export default function YearInReviewBanner() {
  const year = yearInReviewYear();
  const query = useYearInReview(() => year);
  const ready = () =>
    query.isSuccess && query.data?.status === RecapStatus.READY ? query.data : undefined;
  return (
    <Show when={ready()}>
      <A
        href={`/recap/year/${year}`}
        class="loci-card mb-8 flex items-center gap-3 p-4 transition-colors hover:bg-muted/60"
      >
        <Sparkles class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span class="block font-medium">Your {year} in Loci</span>
          <span class="block text-sm text-muted-foreground">
            {ready()?.subtitle || "The cities, the trips and how your taste moved."}
          </span>
        </span>
        <span class="text-sm font-medium text-primary">See it</span>
      </A>
    </Show>
  );
}
