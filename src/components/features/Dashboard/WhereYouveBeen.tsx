// Real travel history in one line. Hidden until there is any; a row of zeros is not a map.
import { Show } from "solid-js";
import { A } from "@solidjs/router";
import { useTravelSummary } from "~/lib/api/travel-history";
import { hasTravelHistory, travelSummaryLine } from "~/lib/dashboard/format";
import SectionHeader from "~/components/ui/SectionHeader";

export default function WhereYouveBeen() {
  const summary = useTravelSummary();
  const data = () => {
    const s = summary.data;
    return s && hasTravelHistory(s) ? s : undefined;
  };

  return (
    <Show when={data()}>
      {(s) => (
        <section class="mb-10" aria-label="Where you've been">
          <SectionHeader
            size="sm"
            kicker="where you've been"
            title="The map so far"
            action={
              <A
                href="/globe"
                class="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Open the globe
              </A>
            }
          />
          <p class="font-coord text-xs uppercase tracking-[0.12em] text-muted-foreground">
            {travelSummaryLine(s())}
          </p>
        </section>
      )}
    </Show>
  );
}
