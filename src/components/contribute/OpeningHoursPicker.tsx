import { For, Show } from "solid-js";
import {
  DAY_LABELS,
  DAYS,
  type Day,
  type OpeningHours,
  encodeOpeningHours,
} from "~/lib/place-facts/opening-hours";

/**
 * Seven rows, one per day, each open for a span or marked closed.
 *
 * Native `<input type="time">` rather than a picker dependency — the same call
 * DateRangeField made for dates, and it brings mobile wheels and keyboard entry
 * for free. The canonical string the week encodes to is shown live, because it
 * is what actually gets compared against another scout's report.
 */
export function OpeningHoursPicker(props: {
  value: OpeningHours;
  onChange: (hours: OpeningHours) => void;
}) {
  const setDay = (day: Day, next: OpeningHours[Day]) =>
    props.onChange({ ...props.value, [day]: next });

  const firstInterval = (day: Day) => {
    const hours = props.value[day];
    return hours.closed ? undefined : hours.intervals[0];
  };

  const setTime = (day: Day, edge: "start" | "end", time: string) => {
    const hours = props.value[day];
    if (hours.closed || time === "") return;
    const [existing = { start: "09:00", end: "17:00" }, ...rest] = hours.intervals;
    setDay(day, {
      closed: false,
      intervals: [{ ...existing, [edge]: time }, ...rest],
    });
  };

  return (
    <div class="mt-2 space-y-2">
      <For each={DAYS}>
        {(day) => (
          <div class="flex items-center gap-2">
            <span class="w-20 shrink-0 text-xs text-muted-foreground">{DAY_LABELS[day]}</span>
            <Show
              when={!props.value[day].closed}
              fallback={<span class="flex-1 text-xs text-muted-foreground">Closed</span>}
            >
              <input
                type="time"
                value={firstInterval(day)?.start ?? "09:00"}
                onChange={(event) => setTime(day, "start", event.currentTarget.value)}
                aria-label={`${DAY_LABELS[day]} opening time`}
                class="rounded-lg border border-border bg-background px-2 py-1 text-sm"
              />
              <span class="text-xs text-muted-foreground">to</span>
              <input
                type="time"
                value={firstInterval(day)?.end ?? "17:00"}
                onChange={(event) => setTime(day, "end", event.currentTarget.value)}
                aria-label={`${DAY_LABELS[day]} closing time`}
                class="rounded-lg border border-border bg-background px-2 py-1 text-sm"
              />
            </Show>
            <button
              type="button"
              onClick={() =>
                setDay(
                  day,
                  props.value[day].closed
                    ? { closed: false, intervals: [{ start: "09:00", end: "17:00" }] }
                    : { closed: true },
                )
              }
              class="ml-auto rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-accent hover:text-foreground"
            >
              {props.value[day].closed ? "Set hours" : "Closed"}
            </button>
          </div>
        )}
      </For>
      <p class="pt-1 font-coord text-[10px] text-muted-foreground">
        Sent as: {encodeOpeningHours(props.value)}
      </p>
    </div>
  );
}
