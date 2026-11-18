import { Show } from "solid-js";
import { describeCheck, type DayTally, type StopCheck } from "~/lib/stop-check";

export interface CheckStampProps {
  check: StopCheck;
  /** The day's ISO date, to name the weekday a place is shut on. */
  dayDate?: string;
  class?: string;
}

/**
 * The stamp under a stop: whether its place was found on a real map, and what
 * the map's hours say about the visit as planned.
 *
 * The mark and the detail are two elements because they are two facts. The
 * mark is stamped; the detail is only written beside it, so "Checked" can
 * never be read as covering hours nobody listed.
 */
export default function CheckStamp(props: CheckStampProps) {
  const line = () => describeCheck(props.check, props.dayDate);

  return (
    <p class={`check-stamp ${props.class ?? ""}`} data-tone={line().tone} title={line().explain}>
      <span class="check-stamp__mark">
        <svg viewBox="0 0 12 12" class="check-stamp__glyph" aria-hidden="true">
          <Show
            when={line().tone !== "unknown"}
            fallback={<path d="M3 6h6" fill="none" stroke="currentColor" stroke-width="1.5" />}
          >
            <path
              d="M2.5 6.4 5 8.8 9.6 3.4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="square"
            />
          </Show>
        </svg>
        {line().mark}
      </span>
      <Show when={line().detail}>
        <span class="check-stamp__detail">{line().detail}</span>
      </Show>
      <span class="sr-only">. {line().explain}</span>
    </p>
  );
}

/**
 * A day's checks in one line, for the day header: "5 of 5 checked", and how
 * many need a look. Renders nothing for a day with no checks.
 */
export function DayVerdictLine(props: { tally: DayTally }) {
  return (
    <Show when={props.tally.total > 0}>
      <span class="check-verdict" data-attention={props.tally.needAttention > 0 ? "" : undefined}>
        <span class="check-verdict__count">
          {props.tally.checked} of {props.tally.total} checked
        </span>
        <Show when={props.tally.needAttention > 0}>
          <span class="check-verdict__attention">
            {props.tally.needAttention} need{props.tally.needAttention === 1 ? "s" : ""} a look
          </span>
        </Show>
      </span>
    </Show>
  );
}

/** The credit OpenStreetMap asks for wherever its data is shown. */
export function CheckSourceNote(props: { class?: string }) {
  return (
    <p
      class={`font-coord text-[10px] uppercase tracking-[0.14em] text-muted-foreground ${props.class ?? ""}`}
    >
      Stops checked against the map ·{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        class="underline decoration-dotted underline-offset-2 hover:text-foreground"
      >
        © OpenStreetMap contributors
      </a>
    </p>
  );
}
