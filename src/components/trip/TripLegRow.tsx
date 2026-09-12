import { Car } from "lucide-solid";
import type { TripLeg } from "~/lib/api/trips";

export interface TripLegRowProps {
  leg: TripLeg;
  /** The final leg has no day after it — it says "heading home" instead of a duration. */
  homeward?: boolean;
}

const legDuration = (mins: number) =>
  `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;

/**
 * The drive between two days, drawn on the same rail as the stops so a
 * transfer reads as part of the route rather than as a stray line of text.
 */
export default function TripLegRow(props: TripLegRowProps) {
  return (
    <div class="mb-6 grid grid-cols-[2.75rem_1fr] gap-x-1 sm:grid-cols-[3.75rem_1fr] sm:gap-x-2">
      <div class="flex items-center justify-end pr-1">
        <Car class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div class="border-l border-dashed border-border py-2 pl-4 sm:pl-5">
        <p class="text-sm text-muted-foreground">
          {props.leg.fromName} → {props.leg.toName}
        </p>
        <p class="font-coord mt-0.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {Math.round(props.leg.distanceKm)} km
          {props.homeward ? " · heading home" : ` · ${legDuration(props.leg.durationMins)}`}
        </p>
      </div>
    </div>
  );
}
