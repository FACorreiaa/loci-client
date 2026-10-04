import { For, Show, createSignal, type Component } from "solid-js";
import { Code, ConnectError } from "@connectrpc/connect";
import type { TripDraft as ProtoTripDraft } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { Button } from "~/ui/button";
import { mapTrip, type FlightCabinName, type FlightLink, type Trip } from "~/lib/api/trips";
import {
  cityCoords,
  hotelsWithStars,
  planApi,
  tripCities,
  type FlightSearch,
  type PlanApi,
} from "~/lib/api/trip-plan";
import type { HotelDetailedInfo } from "~/lib/api/types";

export interface TripPlanPanelProps {
  trip: Trip;
  /** The trip as the server now has it (new version); the page caches it. */
  onUpdated: (trip: Trip) => void;
  /** The trip changed elsewhere; the page refetches and says so. */
  onConflict: () => void;
  /** Injected in tests. */
  api?: PlanApi;
}

const label = "font-coord text-[11px] uppercase tracking-[0.16em] text-muted-foreground";
const field = "rounded-md border border-input bg-background px-2 py-1 text-sm";
const link = "text-sm text-primary underline-offset-2 hover:underline";

/** Links come from the server, but only https ones ever become an href. */
const httpsOnly = (links: FlightLink[]) => links.filter((l) => l.url.startsWith("https://"));

const errorText = (err: unknown, fallback: string) =>
  err instanceof ConnectError && err.rawMessage ? err.rawMessage : fallback;

/**
 * The trip's plan: dates, where it sleeps in each city, and flights. Each
 * write goes through its own TripService RPC with the version the panel was
 * shown, so an edit made elsewhere is a conflict, never an overwrite.
 */
const TripPlanPanel: Component<TripPlanPanelProps> = (props) => {
  const api = () => props.api ?? planApi;
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);

  /** Run a write; true when it landed. */
  const run = async (fn: () => Promise<ProtoTripDraft>): Promise<boolean> => {
    if (busy()) return false;
    setBusy(true);
    setError(null);
    try {
      props.onUpdated(mapTrip(await fn()));
      return true;
    } catch (err) {
      if (err instanceof ConnectError && err.code === Code.FailedPrecondition) props.onConflict();
      else setError(errorText(err, "Something went wrong. Try again."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Dates
  const [start, setStart] = createSignal(props.trip.startDate ?? "");
  const [end, setEnd] = createSignal(props.trip.endDate ?? "");
  const datesReady = () => start() !== "" && end() !== "" && end() >= start();
  const saveDates = () =>
    run(() => api().setDates(props.trip.id, start(), end(), props.trip.version));

  // Stays
  const [stars, setStars] = createSignal<Record<string, number>>({});
  const [found, setFound] = createSignal<Record<string, HotelDetailedInfo[]>>({});
  const stayFor = (city: string) =>
    props.trip.stays.find((s) => s.cityName.toLowerCase() === city.toLowerCase());
  // Per city: a search in flight, and the star filter the last finished one used
  // (so an empty result can say what it looked for).
  const [searching, setSearching] = createSignal<Record<string, boolean>>({});
  const [searchedStars, setSearchedStars] = createSignal<Record<string, number>>({});
  const findHotels = async (city: string) => {
    const at = cityCoords(props.trip, city);
    if (!at || searching()[city]) return;
    setError(null);
    setSearching({ ...searching(), [city]: true });
    const want = stars()[city] ?? 0;
    try {
      const hotels = await api().hotelsNear(at.lat, at.lon);
      setFound({ ...found(), [city]: hotelsWithStars(hotels, want).slice(0, 5) });
      setSearchedStars({ ...searchedStars(), [city]: want });
    } catch {
      setError(`Couldn't look up hotels in ${city} right now.`);
    } finally {
      setSearching({ ...searching(), [city]: false });
    }
  };
  const noHotelsText = (city: string) => {
    const want = searchedStars()[city] ?? 0;
    return want > 0
      ? `No ${want}★ hotels within 5 km of ${city}. Try any stars.`
      : `No hotels found within 5 km of ${city}.`;
  };
  const pickHotel = async (city: string, h: HotelDetailedInfo) => {
    const ok = await run(() =>
      api().setStay(
        props.trip.id,
        {
          cityName: city,
          poiId: h.id || undefined,
          name: h.name,
          starRating: h.star_rating ? String(h.star_rating) : undefined,
          bookingUrl: h.website?.startsWith("https://") ? h.website : undefined,
        },
        props.trip.version,
      ),
    );
    if (ok) setFound({ ...found(), [city]: [] });
  };

  // Flights
  const [from, setFrom] = createSignal("");
  const [to, setTo] = createSignal(tripCities(props.trip)[0] ?? "");
  const [depart, setDepart] = createSignal(props.trip.startDate ?? "");
  const [ret, setRet] = createSignal(props.trip.endDate ?? "");
  const [pax, setPax] = createSignal(1);
  const [cabin, setCabin] = createSignal<FlightCabinName | "">("");
  const [links, setLinks] = createSignal<FlightLink[]>([]);
  const search = (): FlightSearch => ({
    origin: { name: from() },
    destination: { name: to() },
    departDate: depart(),
    returnDate: ret() || undefined,
    passengers: pax(),
    cabin: cabin() || undefined,
  });
  const flightReady = () =>
    from().trim() !== "" && to().trim() !== "" && depart() !== "" && (!ret() || ret() >= depart());
  const buildLinks = async () => {
    setError(null);
    try {
      setLinks(await api().buildLinks(search()));
    } catch (err) {
      setError(errorText(err, "Couldn't build the flight search."));
    }
  };
  const saveFlight = async () => {
    const ok = await run(() => api().addFlight(props.trip.id, search(), props.trip.version));
    if (ok) setLinks([]);
  };

  return (
    <section class="loci-card mb-6 p-4 sm:p-5" aria-label="Trip plan" data-testid="trip-plan">
      <h2 class="font-display text-lg font-semibold">Plan</h2>
      <Show when={error()}>
        <p role="alert" class="mt-2 text-sm text-destructive">
          {error()}
        </p>
      </Show>

      <div class="mt-4">
        <p class={label}>Dates</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Start date"
            class={field}
            data-testid="plan-start"
            value={start()}
            onInput={(e) => setStart(e.currentTarget.value)}
          />
          <span class="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            aria-label="End date"
            class={field}
            data-testid="plan-end"
            value={end()}
            min={start()}
            onInput={(e) => setEnd(e.currentTarget.value)}
          />
          <Button
            size="sm"
            data-testid="plan-save-dates"
            disabled={busy() || !datesReady()}
            onClick={saveDates}
          >
            Save dates
          </Button>
        </div>
      </div>

      <div class="mt-5">
        <p class={label}>Where you stay</p>
        <For each={tripCities(props.trip)}>
          {(city) => (
            <div class="mt-2 rounded-xl border border-border px-3 py-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-medium">{city}</span>
                <Show
                  when={stayFor(city)}
                  fallback={<span class="text-xs text-muted-foreground">No hotel yet</span>}
                >
                  {(s) => (
                    <span class="text-sm">
                      {s().name}
                      <Show when={s().starRating}> · {s().starRating}★</Show>
                    </span>
                  )}
                </Show>
              </div>
              <Show
                when={cityCoords(props.trip, city)}
                fallback={
                  <p class="mt-1 text-xs text-muted-foreground">
                    We can't search hotels in {city}: the trip has no map position for it yet.
                  </p>
                }
              >
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Hotel stars in ${city}`}
                    class={field}
                    data-testid={`plan-stars-${city}`}
                    onChange={(e) =>
                      setStars({ ...stars(), [city]: Number(e.currentTarget.value) })
                    }
                  >
                    <option value="0">Any stars</option>
                    <option value="3">3★</option>
                    <option value="4">4★</option>
                    <option value="5">5★</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`plan-find-${city}`}
                    disabled={!!searching()[city]}
                    onClick={() => findHotels(city)}
                  >
                    {searching()[city] ? "Searching…" : "Find hotels"}
                  </Button>
                </div>
                <Show
                  when={searchedStars()[city] !== undefined && (found()[city] ?? []).length === 0}
                >
                  <p
                    class="mt-2 text-xs text-muted-foreground"
                    data-testid={`plan-no-hotels-${city}`}
                  >
                    {noHotelsText(city)}
                  </p>
                </Show>
                <ul class="mt-2 space-y-1">
                  <For each={found()[city] ?? []}>
                    {(h) => (
                      <li>
                        <button
                          type="button"
                          data-testid="plan-hotel"
                          disabled={busy()}
                          class="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted disabled:opacity-60"
                          onClick={() => pickHotel(city, h)}
                        >
                          {h.name}
                          <Show when={h.star_rating}> · {h.star_rating}★</Show>
                          <Show when={h.rating}> · {h.rating.toFixed(1)}</Show>
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </div>
          )}
        </For>
      </div>

      <div class="mt-5">
        <p class={label}>Flights</p>
        <For each={props.trip.flights}>
          {(f) => (
            <div class="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <span>
                {f.origin.name} → {f.destination.name} · {f.departDate}
                <Show when={f.returnDate}> – {f.returnDate}</Show>
              </span>
              <span class="flex flex-wrap items-center gap-3">
                <For each={httpsOnly(f.links)}>
                  {(l) => (
                    <a class={link} href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.label}
                    </a>
                  )}
                </For>
                <button
                  type="button"
                  class="text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
                  disabled={busy()}
                  onClick={() =>
                    run(() => api().removeFlight(props.trip.id, f.id, props.trip.version))
                  }
                >
                  Remove
                </button>
              </span>
            </div>
          )}
        </For>
        <div class="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            class={field}
            aria-label="From"
            placeholder="From (city or airport)"
            data-testid="plan-from"
            value={from()}
            onInput={(e) => setFrom(e.currentTarget.value)}
          />
          <input
            class={field}
            aria-label="To"
            placeholder="To"
            data-testid="plan-to"
            value={to()}
            onInput={(e) => setTo(e.currentTarget.value)}
          />
          <input
            type="date"
            aria-label="Departure date"
            class={field}
            data-testid="plan-depart"
            value={depart()}
            onInput={(e) => setDepart(e.currentTarget.value)}
          />
          <input
            type="date"
            aria-label="Return date"
            class={field}
            data-testid="plan-return"
            value={ret()}
            min={depart()}
            onInput={(e) => setRet(e.currentTarget.value)}
          />
          <input
            type="number"
            min="1"
            max="9"
            aria-label="Travellers"
            class={field}
            value={pax()}
            onInput={(e) => setPax(Math.min(9, Math.max(1, Number(e.currentTarget.value) || 1)))}
          />
          <select
            aria-label="Cabin"
            class={field}
            onChange={(e) => setCabin(e.currentTarget.value as FlightCabinName | "")}
          >
            <option value="">Any cabin</option>
            <option value="economy">Economy</option>
            <option value="premium_economy">Premium economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </select>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            data-testid="plan-links"
            disabled={!flightReady()}
            onClick={buildLinks}
          >
            Search flights
          </Button>
          <For each={httpsOnly(links())}>
            {(l) => (
              <a class={link} href={l.url} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            )}
          </For>
          <Show when={links().length > 0}>
            <Button size="sm" data-testid="plan-save-flight" disabled={busy()} onClick={saveFlight}>
              Save to trip
            </Button>
          </Show>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          Prices are on the airline sites; Loci only saves your search.
        </p>
      </div>
    </section>
  );
};

export default TripPlanPanel;
