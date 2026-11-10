import { For, Show, createEffect, createSignal, on } from "solid-js";
import { Plane } from "lucide-solid";
import { Button } from "~/ui/button";
import { Skeleton } from "~/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/ui/dialog";
import {
  planApi,
  type FlightPlaceOption,
  type FlightSearch,
  type PlanApi,
} from "~/lib/api/trip-plan";
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
  /**
   * Saves the search to the page's trip; resolves true when it was saved.
   * Only a trip page passes it, so only there does the dialog offer Save.
   */
  onSave?: (search: FlightSearch) => Promise<boolean>;
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
  const [saving, setSaving] = createSignal(false);
  const [saveFailed, setSaveFailed] = createSignal(false);
  const save = async (search: FlightSearch) => {
    if (!props.onSave) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      if (await props.onSave(search)) props.onOpenChange(false);
      else setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

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
      <DialogContent class="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find flights to {props.city}</DialogTitle>
          <DialogDescription>
            Where are you flying from? Loci opens the search on partner sites.
          </DialogDescription>
        </DialogHeader>
        <Show
          when={dest() !== undefined}
          fallback={
            // The shape of the form, so the dialog does not jump when it lands.
            <div role="status">
              <p class="mb-3 text-sm text-muted-foreground">Finding the airport…</p>
              <div class="grid gap-3 sm:grid-cols-2" aria-hidden="true">
                <For each={[0, 1, 2, 3, 4, 5]}>
                  {() => (
                    <div>
                      <Skeleton class="mb-1 h-4 w-16" />
                      <Skeleton class="h-11 w-full rounded-lg sm:h-10" />
                    </div>
                  )}
                </For>
              </div>
              <Skeleton class="mt-4 h-11 w-32 rounded-lg sm:h-10" aria-hidden="true" />
            </div>
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
            extraActions={
              props.onSave
                ? (search) => (
                    <Button
                      size="sm"
                      data-testid="flight-save"
                      disabled={saving()}
                      onClick={() => void save(search)}
                    >
                      Save to trip
                    </Button>
                  )
                : undefined
            }
          />
          <Show when={saveFailed()}>
            <p class="mt-2 text-sm text-destructive" role="alert">
              Couldn't save the flight to the trip. Try again.
            </p>
          </Show>
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
