import { For } from "solid-js";
import { Skeleton } from "~/ui/skeleton";

/**
 * Loading state shaped like the real page.
 *
 * This is not a nicety on this route: useAppQuery skips fetching during SSR,
 * so the first paint of /trips/:id is *always* this component.
 */
export default function TripDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading trip">
      <Skeleton class="mb-4 h-44 rounded-3xl sm:h-52" />
      <div class="mb-8 flex flex-wrap gap-2">
        <For each={[1, 2, 3]}>{() => <Skeleton class="h-9 w-20 rounded-lg" />}</For>
      </div>
      <Skeleton class="mb-8 h-14 rounded-2xl" />
      <For each={[1, 2]}>
        {() => (
          <section class="loci-card mb-6 p-4">
            <Skeleton class="h-5 w-32" />
            <Skeleton class="mt-2 h-3 w-56" />
            <div class="mt-5 space-y-5">
              <For each={[1, 2, 3]}>
                {() => (
                  <div class="grid grid-cols-[2.75rem_1fr] gap-x-2 sm:grid-cols-[3.75rem_1fr]">
                    <Skeleton class="h-3 w-9 justify-self-end" />
                    <div class="border-l border-border pl-4 sm:pl-5">
                      <Skeleton class="h-4 w-2/3" />
                      <Skeleton class="mt-2 h-3 w-full max-w-sm" />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </section>
        )}
      </For>
    </div>
  );
}
