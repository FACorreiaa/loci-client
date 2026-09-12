import { Show } from "solid-js";
import {
  defaultWeekend,
  formatWindow,
  fromDateInputValue,
  nextWeekend,
  toDateInputValue,
  type DateWindow,
} from "~/lib/compare-defaults";

interface DateRangeFieldProps {
  window: DateWindow;
  onChange: (window: DateWindow) => void;
}

/**
 * When the trip is.
 *
 * The window used to be fixed to the next weekend and computed once when the
 * page loaded, so it could not be changed and quietly went stale on a tab left
 * open. Two native date inputs rather than a picker component: src/ui has no
 * calendar primitive, and one field does not justify the dependency.
 */
export function DateRangeField(props: DateRangeFieldProps) {
  const invalid = () => props.window.end <= props.window.start;

  const setStart = (value: string) => {
    const start = fromDateInputValue(value);
    if (!start) return;
    // Dragging the start past the end would otherwise leave an impossible
    // window that only fails at the server.
    const end = props.window.end > start ? props.window.end : endOfNextDay(start);
    props.onChange({ start, end });
  };

  const setEnd = (value: string) => {
    const end = fromDateInputValue(value, true);
    if (!end) return;
    props.onChange({ start: props.window.start, end });
  };

  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium">When</span>
        <div class="flex gap-1">
          <button
            type="button"
            class="loci-chip loci-chip--surface text-xs"
            onClick={() => props.onChange(defaultWeekend())}
          >
            This weekend
          </button>
          <button
            type="button"
            class="loci-chip loci-chip--surface text-xs"
            onClick={() => props.onChange(nextWeekend())}
          >
            Next weekend
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <input
          type="date"
          aria-label="Start date"
          class="flex-1 rounded-lg border px-3 py-2 bg-transparent"
          value={toDateInputValue(props.window.start)}
          onChange={(e) => setStart(e.currentTarget.value)}
        />
        <span class="text-muted-foreground text-sm">to</span>
        <input
          type="date"
          aria-label="End date"
          class="flex-1 rounded-lg border px-3 py-2 bg-transparent"
          value={toDateInputValue(props.window.end)}
          onChange={(e) => setEnd(e.currentTarget.value)}
        />
      </div>

      <Show
        when={invalid()}
        fallback={<p class="text-xs text-muted-foreground">{formatWindow(props.window)}</p>}
      >
        <p class="text-xs text-destructive">The end date needs to be after the start date.</p>
      </Show>
    </div>
  );
}

function endOfNextDay(start: Date): Date {
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  end.setHours(23, 59, 0, 0);
  return end;
}

export default DateRangeField;
