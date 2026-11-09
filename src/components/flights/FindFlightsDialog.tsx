import { Show, createEffect, createSignal, on } from "solid-js";
import { Plane } from "lucide-solid";
import { Button } from "~/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/ui/dialog";
import { planApi, type FlightPlaceOption, type PlanApi } from "~/lib/api/trip-plan";
import { trackFlightOpened, type FlightSource } from "~/lib/flights/analytics";
import FlightSearchForm from "./FlightSearchForm";
import { optionLabel, optionPlace } from "./AirportField";

export interface FindFlightsProps {
  source: FlightSource;
  /** The destination city as the page knows it. */
  city: string;
  /** ISO-2 when known; anything else is ignored. */
  countryCode?: string;
  lat?: number;
  lon?: number;
  startDate?: string;
  endDate?: string;
  /** Injected in tests. */
  api?: PlanApi;
}

/**
 * Flights to the page's city: the destination is resolved to its airport
 * (or metro code) and shown, the traveller says where they fly from — every
 * time, nothing is stored — and gets partner searches to book on.
 */
export default function FindFlightsDialog(
  props: FindFlightsProps & { open: boolean; onOpenChange: (open: boolean) => void },
) {
  const api = () => props.api ?? planApi;
  const [dest, setDest] = createSignal<FlightPlaceOption | null | undefined>(undefined);

  createEffect(
    on(
      () => [props.open, props.city] as const,
      async ([open, city]) => {
        if (!open || !city) return;
        setDest(undefined);
        let found: FlightPlaceOption | undefined;
        try {
          found = await api().resolveDestination(city, props.countryCode, props.lat, props.lon);
        } catch {
          found = undefined;
        }
        setDest(found ?? null);
        trackFlightOpened(props.source, found?.iata);
      },
    ),
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Find flights to {props.city}</DialogTitle>
          <DialogDescription>
            Where are you flying from? Loci opens the search on partner sites.
          </DialogDescription>
        </DialogHeader>
        <Show
          when={dest() !== undefined}
          fallback={
            <p class="text-sm text-muted-foreground" role="status">
              Finding the airport…
            </p>
          }
        >
          <FlightSearchForm
            source={props.source}
            api={api()}
            initial={{
              toText: dest() ? optionLabel(dest()!) : props.city,
              to: dest() ? optionPlace(dest()!) : { name: props.city },
              departDate: props.startDate,
              returnDate: props.endDate,
            }}
          />
        </Show>
      </DialogContent>
    </Dialog>
  );
}

/** The entry point: a button that opens the dialog. */
export function FindFlightsButton(props: FindFlightsProps) {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <Button size="sm" variant="outline" data-testid="find-flights" onClick={() => setOpen(true)}>
        <Plane class="mr-1.5 h-4 w-4" aria-hidden="true" />
        Find flights to {props.city}
      </Button>
      <Show when={open()}>
        <FindFlightsDialog {...props} open={open()} onOpenChange={setOpen} />
      </Show>
    </>
  );
}
