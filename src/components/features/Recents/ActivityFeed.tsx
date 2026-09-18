import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Sparkles, History } from "lucide-solid";
import { Button } from "~/ui/button";
import { Skeleton } from "~/ui/skeleton";
import type { ActivityDayGroup } from "~/lib/recents/day-buckets";
import ActivityRow from "./ActivityRow";

export interface ActivityFeedProps {
  groups: ActivityDayGroup[];
  now: Date;
  profileId?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** True when a filter or search is narrowing the list, which changes the empty copy. */
  isFiltered: boolean;
}

export default function ActivityFeed(props: ActivityFeedProps) {
  return (
    <Show
      when={!props.isLoading}
      fallback={
        <div class="space-y-3">
          <For each={[0, 1, 2, 3, 4, 5]}>
            {() => (
              <div class="flex items-start gap-3 px-3 py-3">
                <Skeleton class="h-8 w-8 shrink-0 rounded-lg" />
                <div class="flex-1 space-y-2">
                  <Skeleton class="h-4 w-2/3" />
                  <Skeleton class="h-3 w-1/4" />
                </div>
              </div>
            )}
          </For>
        </div>
      }
    >
      {/* An error must not read as an empty history. "Nothing here yet" and
          "we could not reach the server" call for very different reactions,
          and the old recents module collapsed both into an empty list. */}
      <Show when={!props.isError} fallback={<FeedError onRetry={props.onRetry} />}>
        <Show when={props.groups.length > 0} fallback={<FeedEmpty isFiltered={props.isFiltered} />}>
          <div class="space-y-8">
            <For each={props.groups}>
              {(group) => (
                <section>
                  <h2 class="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </h2>
                  <div class="divide-y divide-border/60">
                    <For each={group.entries}>
                      {(entry) => (
                        <ActivityRow entry={entry} now={props.now} profileId={props.profileId} />
                      )}
                    </For>
                  </div>
                </section>
              )}
            </For>
          </div>

          <Show when={props.hasMore}>
            <div class="mt-8 flex justify-center">
              <Button variant="outline" onClick={props.onLoadMore} disabled={props.isLoadingMore}>
                {props.isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          </Show>
        </Show>
      </Show>
    </Show>
  );
}

function FeedError(props: { onRetry: () => void }) {
  return (
    <div class="py-12 text-center">
      <h3 class="mb-2 text-lg font-semibold text-foreground">Could not load your activity</h3>
      <p class="mb-4 text-muted-foreground">The history is still there. This is on our side.</p>
      <Button onClick={props.onRetry}>Try again</Button>
    </div>
  );
}

function FeedEmpty(props: { isFiltered: boolean }) {
  return (
    <div class="py-12 text-center">
      <History class="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
      <h3 class="mb-2 text-lg font-semibold text-foreground">
        {props.isFiltered ? "Nothing of that kind yet" : "No activity yet"}
      </h3>
      <p class="mb-4 text-muted-foreground">
        {props.isFiltered
          ? "Try another type, or clear the search."
          : "Everything you ask, save or favourite shows up here."}
      </p>
      <Show when={!props.isFiltered}>
        <A
          href="/discover"
          class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Sparkles class="h-4 w-4" />
          Start exploring
        </A>
      </Show>
    </div>
  );
}
