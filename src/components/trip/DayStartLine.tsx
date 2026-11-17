import { Show } from "solid-js";
import { Footprints, TramFront } from "lucide-solid";
import type { DayStart } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { trackStayDirectionsOpened, type StayTransportSource } from "~/lib/hotels/analytics";

/** Only an https link ever becomes an href. */
export const httpsUrl = (url: string | undefined) =>
  url && url.startsWith("https://") ? url : undefined;

/**
 * How a day begins from the stay: the walk to its first stop, or a nudge to
 * take public transport when that is too far to walk, with a link that opens
 * the journey in a maps app. Drawn like the walk between two stops
 * (WalkingLegRow), which is what it is.
 */
export default function DayStartLine(props: { start: DayStart; source: StayTransportSource }) {
  const transit = () => props.start.suggestedMode === "transit";
  const walk = () =>
    props.start.walkMinutes > 0 ? `${props.start.walkMinutes} min walk` : "a short walk";
  return (
    <div class="ml-4 border-l-2 border-dashed border-border py-1 pl-3" data-testid="day-start-line">
      <p class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <Show
          when={transit()}
          fallback={<Footprints class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        >
          <TramFront class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </Show>
        <span class="text-foreground">
          From your hotel: {transit() ? "public transport suggested" : walk()}
        </span>
        <Show when={!transit() && !props.start.routed}>
          <span>· Straight-line estimate, route not checked</span>
        </Show>
        <Show when={httpsUrl(props.start.googleDirectionsUrl)}>
          {(url) => (
            <>
              <span aria-hidden="true">·</span>
              <a
                class="no-print font-medium text-primary underline-offset-2 hover:underline"
                href={url()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackStayDirectionsOpened(props.source, "day", transit() ? "transit" : "walk")
                }
              >
                Directions
                <span class="sr-only">
                  {" "}
                  from your hotel to {props.start.firstStopName || "the day's first stop"} (opens
                  Google Maps)
                </span>
              </a>
            </>
          )}
        </Show>
      </p>
    </div>
  );
}
