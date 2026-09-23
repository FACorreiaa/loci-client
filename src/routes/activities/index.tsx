import { Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { createSessionKey } from "~/lib/runs/session-key";
import ResultsPage from "~/components/results/ResultsPage";

/**
 * Keyed on the search it shows, so Open from a toast to this same route with
 * another sessionId remounts the body and its restore logic runs for that
 * session (Solid Router keeps a route mounted across query changes). See
 * session-key.ts for why the page's own run naming itself does not remount.
 *
 * The body is ResultsPage, shared with the other two list routes.
 */
export default function ActivitiesPage() {
  const [searchParams] = useSearchParams();
  const session = createSessionKey(() => searchParams);
  return (
    <Show when={session.key()} keyed>
      {(_key) => <ResultsPage domain="activities" adopt={session.adopt} />}
    </Show>
  );
}
