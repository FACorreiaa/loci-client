import { Show } from "solid-js";
import { CalendarDays, MapPin, Pencil, Share2 } from "lucide-solid";
import { Button } from "~/ui/button";
import { Toggle } from "~/ui/toggle";
import TripExportMenu from "~/components/trip/TripExportMenu";
import { formatTripDates } from "~/lib/trip-format";
import type { Trip } from "~/lib/api/trips";

export interface TripHeroProps {
  trip: Trip;
  tripId: string;
  isPro: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onShare: () => void;
  sharing: boolean;
}

/**
 * Trip masthead, matching the hero on /trips so a trip does not visually
 * demote itself the moment you open it.
 *
 * The action row deliberately sits *below* the hero rather than inside it:
 * TripExportMenu is styled for the page surface (bordered buttons on card),
 * and those read as smudges on the hero gradient.
 *
 * The trip's `version` is not shown. It is optimistic-concurrency bookkeeping,
 * not something a traveller has any use for.
 */
export default function TripHero(props: TripHeroProps) {
  const dayCount = () => props.trip.days.length;
  const dateRange = () => formatTripDates(props.trip.days);

  return (
    <>
      <section class="loci-hero mb-4">
        <div class="loci-hero__content p-6 sm:p-9">
          <p class="font-coord mb-3 text-[10px] uppercase tracking-[0.2em] text-primary-foreground/65">
            Route · {dayCount()} day{dayCount() === 1 ? "" : "s"}
          </p>
          <h1 class="max-w-3xl text-3xl text-primary-foreground sm:text-4xl">{props.trip.title}</h1>
          <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-primary-foreground/75">
            <Show when={props.trip.cityName}>
              <span class="inline-flex items-center gap-1.5">
                <MapPin class="h-4 w-4" aria-hidden="true" />
                {props.trip.cityName}
              </span>
            </Show>
            <Show when={dateRange()}>
              <span class="font-coord inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em]">
                <CalendarDays class="h-3.5 w-3.5" aria-hidden="true" />
                {dateRange()}
              </span>
            </Show>
          </div>
        </div>
      </section>

      <div class="no-print mb-8 flex flex-wrap items-center gap-2">
        <TripExportMenu
          tripId={props.tripId}
          dayCount={dayCount()}
          isPro={props.isPro}
          trip={props.trip}
        />
        <div class="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button
            variant="outline"
            size="sm"
            class="h-9 gap-1.5"
            disabled={props.sharing}
            onClick={props.onShare}
          >
            <Share2 class="h-4 w-4" aria-hidden="true" />
            Share
          </Button>
          <Toggle
            variant="outline"
            class="gap-1.5"
            pressed={props.editing}
            onChange={props.onEditingChange}
            aria-label="Edit this trip"
          >
            <Pencil class="h-4 w-4" aria-hidden="true" />
            {props.editing ? "Done" : "Edit"}
          </Toggle>
        </div>
      </div>
    </>
  );
}
