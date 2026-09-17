// Breaking news for the places that matter to this traveller. One row of
// chips, grouped by country in the order the server chose (home, next trip,
// recent visits). Absent when the person switched it off or there is nothing
// to show; a stale strip says so rather than pretending.
import { For, Show, createMemo } from "solid-js";
import { A } from "@solidjs/router";
import { useNewsTicker } from "~/lib/api/newsTicker";
import { flagFor, groupByCountry, timeAgo } from "~/lib/news/ticker";

export default function NewsTickerBand() {
  const query = useNewsTicker();
  const groups = createMemo(() => {
    const data = query.data;
    if (!data || !data.enabled || data.items.length === 0) return [];
    return groupByCountry(data);
  });
  const now = () => new Date();

  return (
    <Show when={groups().length > 0}>
      <section class="mb-8" aria-label="Breaking news">
        <div class="mb-2 flex items-baseline justify-between gap-4">
          <p class="font-coord text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Breaking news
            <Show when={query.data?.stale}>
              <span class="ml-2 normal-case tracking-normal">· some sources delayed</span>
            </Show>
          </p>
          <A href="/settings#news" class="text-xs text-muted-foreground hover:text-foreground">
            Manage
          </A>
        </div>
        <div class="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]" role="list">
          <For each={groups()}>
            {(group) => (
              <For each={group.items.slice(0, 4)}>
                {(item) => (
                  <a
                    role="listitem"
                    href={item.url}
                    target="_blank"
                    rel="noopener"
                    class="loci-chip--surface flex w-72 shrink-0 snap-start flex-col gap-1 rounded-2xl px-4 py-3 text-left active:scale-[0.98]"
                  >
                    <span class="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Show when={flagFor(group.code)}>{(f) => <span aria-hidden="true">{f()}</span>}</Show>
                      <span class="truncate">{item.source}</span>
                      <span aria-hidden="true">·</span>
                      <span>{timeAgo(item.publishedAt, now())}</span>
                    </span>
                    <span class="line-clamp-2 text-sm text-foreground">{item.title}</span>
                  </a>
                )}
              </For>
            )}
          </For>
        </div>
        <p class="mt-1 text-[11px] text-muted-foreground">Headlines from publishers' own feeds. Links open the publisher.</p>
      </section>
    </Show>
  );
}
