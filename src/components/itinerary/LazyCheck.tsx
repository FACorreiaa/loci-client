import { lazy, Show, Suspense } from "solid-js";
import type { CheckStampProps } from "./CheckStamp";
import type { DayTally } from "~/lib/stop-check";

const Stamp = lazy(() => import("./CheckStamp"));
const Verdict = lazy(() => import("./CheckStamp").then((m) => ({ default: m.DayVerdictLine })));
const Source = lazy(() => import("./CheckStamp").then((m) => ({ default: m.CheckSourceNote })));

/**
 * The stamp, the day's sum and the map credit, loaded the first time one is
 * drawn.
 *
 * A plan has no checks until the server has looked its places up, and many
 * never will (outside the mapped region, or signed out), so the pages that
 * can show a stamp do not pay for it up front. Each has its own Suspense with
 * nothing in it: without one the chunk's load would suspend to the app's
 * boundary and blank the whole route for a frame.
 */
export function CheckStamp(props: CheckStampProps) {
  return (
    <Suspense>
      <Stamp {...props} />
    </Suspense>
  );
}

export function DayVerdictLine(props: { tally: DayTally }) {
  // Asked for on every day header, so the empty case is settled here: a day
  // with no checks must not be what fetches the chunk.
  return (
    <Show when={props.tally.total > 0}>
      <Suspense>
        <Verdict {...props} />
      </Suspense>
    </Show>
  );
}

export function CheckSourceNote(props: { class?: string }) {
  return (
    <Suspense>
      <Source {...props} />
    </Suspense>
  );
}
