import { Show } from "solid-js";
import { ChevronLeft, ChevronRight } from "lucide-solid";
import { pageCount, pageRange } from "~/lib/contribute/paginate";

export function TaskPager(props: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = () => pageCount(props.total);
  const range = () => pageRange(props.page, props.total);
  const atStart = () => props.page <= 1;
  const atEnd = () => props.page >= pages();

  return (
    <Show when={props.total > 0}>
      <nav
        class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        aria-label="Places that need a look"
      >
        <p class="font-coord text-[11px] uppercase tracking-wider text-muted-foreground">
          Places {range().start}–{range().end} of {props.total}
        </p>
        <Show when={pages() > 1}>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-semibold transition-transform hover:border-accent disabled:cursor-not-allowed disabled:opacity-40 motion-press"
              disabled={atStart()}
              onClick={() => props.onPageChange(props.page - 1)}
            >
              <ChevronLeft class="h-4 w-4" />
              <span class="hidden sm:inline">Previous</span>
              <span class="sr-only sm:hidden">Previous page</span>
            </button>
            <p
              class="min-w-16 text-center text-sm tabular-nums text-muted-foreground"
              aria-live="polite"
            >
              {props.page} of {pages()}
            </p>
            <button
              type="button"
              class="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-semibold transition-transform hover:border-accent disabled:cursor-not-allowed disabled:opacity-40 motion-press"
              disabled={atEnd()}
              onClick={() => props.onPageChange(props.page + 1)}
            >
              <span class="hidden sm:inline">Next</span>
              <span class="sr-only sm:hidden">Next page</span>
              <ChevronRight class="h-4 w-4" />
            </button>
          </div>
        </Show>
      </nav>
    </Show>
  );
}
