import { For, Show, createSignal, onMount, type Component } from "solid-js";
import { Code, ConnectError } from "@connectrpc/connect";
import type { ActionProposal } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import type {
  ComparedHotel,
  HotelComparisonReport,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/hotel_report_pb.js";
import { mapTrip, useTrips, type Trip } from "~/lib/api/trips";
import { tripActionApi, tripActionErrorMessage, type TripActionApi } from "~/lib/api/trip-actions";
import {
  CityNotOnTripError,
  hotelName,
  setStayFromReport,
  stayEligibility,
  stayWriter,
  type StayAdded,
  type StayWriter,
} from "~/lib/hotels/stay-from-report";
import {
  trackHotelAddTapped,
  trackHotelReportShown,
  trackHotelStaySet,
  type HotelReportSource,
} from "~/lib/hotels/analytics";

/** What the picker needs of the trips list query. */
export interface TripsSource {
  isPending: boolean;
  isError: boolean;
  data?: Trip[] | null;
}

export interface HotelComparisonCardProps {
  report: HotelComparisonReport;
  /** Where the card is read, for analytics. */
  source: HotelReportSource;
  /**
   * The choose_stay proposal that came with the report: its options are these
   * hotels in order. Absent when no trip was found, and the card offers a
   * trip picker instead.
   */
  proposal?: ActionProposal;
  /**
   * The version of the proposal's trip, when the surface already holds that
   * trip. Left out, the card reads the trip before applying.
   */
  tripVersion?: bigint;
  /** Narrower, for the Ask Loci overlay. */
  compact?: boolean;
  /** Set once a hotel from this report is on a trip: the buttons are done. */
  added?: StayAdded;
  /** A hotel is now a trip's stay; `trip` is the trip as saved, when known. */
  onAdded?: (added: StayAdded, trip: Trip | undefined) => void;
  /** The proposal's trip changed since it was read: the surface refetches it. */
  onConflict?: (tripId: string) => void;
  /** "Plan a <City> trip", when no trip can take the hotel. */
  onPlanTrip?: (query: string, city: string) => void;
  /** The link to the trip was followed (the overlay closes). */
  onNavigate?: () => void;
  /** Injected in tests, and by the overlay (which confirms through its own RPC). */
  actionApi?: TripActionApi;
  stayApi?: StayWriter;
  tripsSource?: () => TripsSource;
}

const pill =
  "min-h-9 rounded-full px-4 py-1.5 text-left text-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const primary = `${pill} bg-[var(--muse-user-bubble)] font-semibold text-[var(--muse-user-text)]`;
const secondary = `${pill} bg-[var(--muse-pill)] font-medium text-[var(--muse-text)]`;
const label =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muse-text-secondary)]";
const quiet = "text-[12px] text-[var(--muse-text-secondary)]";
const linkClass = "underline underline-offset-2";

/** Only an https link ever becomes an href; anything else stays unlinked. */
const https = (url: string | undefined) => (url && url.startsWith("https://") ? url : undefined);

const isVersionConflict = (err: unknown) =>
  err instanceof ConnectError &&
  err.code === Code.FailedPrecondition &&
  err.rawMessage.includes("version");

const defaultTripsSource = (): TripsSource => useTrips({ includeMember: true });

/**
 * The trips a report's hotel could go on. A trip that has the city and is the
 * caller's own can be picked; the rest are listed with the reason they can't.
 */
const TripPicker: Component<{
  city: string;
  hotel: string;
  busy: boolean;
  tripsSource?: () => TripsSource;
  onPick: (trip: Trip) => void;
  onPlanTrip?: () => void;
  onCancel: () => void;
}> = (props) => {
  const query = (props.tripsSource ?? defaultTripsSource)();
  // Guarded: reading `.data` of a pending query suspends the route.
  const trips = () => (query.isPending ? [] : (query.data ?? []));
  const rows = () =>
    trips()
      .map((trip) => ({ trip, can: stayEligibility(trip, props.city) }))
      .sort((a, b) => Number(b.can.ok) - Number(a.can.ok));
  const anyEligible = () => rows().some((r) => r.can.ok);

  return (
    <div
      role="group"
      aria-label={`Choose a trip for ${props.hotel}`}
      class="mt-3 rounded-xl bg-[var(--muse-pill)] p-3"
      data-testid="hotel-report-picker"
    >
      <p class="text-sm font-semibold">Add {props.hotel} to which trip?</p>
      <Show when={!query.isPending} fallback={<p class={`mt-2 ${quiet}`}>Loading your trips…</p>}>
        <Show
          when={!query.isError}
          fallback={
            <p role="alert" class="mt-2 text-[13px] text-destructive">
              Couldn't load your trips. Try again.
            </p>
          }
        >
          <ul class="mt-2 space-y-1">
            <For each={rows()}>
              {(row) => (
                <li>
                  <button
                    type="button"
                    data-testid="hotel-report-trip"
                    disabled={!row.can.ok || props.busy}
                    onClick={() => props.onPick(row.trip)}
                    class="w-full rounded-xl bg-[var(--muse-agent-bubble)] px-3 py-2 text-left text-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span class="font-medium">{row.trip.title || row.trip.cityName}</span>
                    <Show when={!row.can.ok && row.can}>
                      {(no) => <span class={`block ${quiet}`}>{no().reason}</span>}
                    </Show>
                  </button>
                </li>
              )}
            </For>
          </ul>
          <Show when={!anyEligible()}>
            <p class={`mt-2 ${quiet}`} data-testid="hotel-report-no-trip">
              None of your trips goes to {props.city}.
            </p>
          </Show>
        </Show>
      </Show>
      <div class="mt-3 flex flex-wrap gap-2">
        <Show when={!query.isPending && !anyEligible() && props.onPlanTrip}>
          <button
            type="button"
            class={primary}
            data-testid="hotel-report-plan"
            onClick={() => props.onPlanTrip?.()}
          >
            Plan a {props.city} trip
          </button>
        </Show>
        <button type="button" class={secondary} onClick={() => props.onCancel()}>
          Cancel
        </button>
      </div>
    </div>
  );
};

/**
 * Loci's answer to "which of these should I book?": the verdict, the
 * side-by-side table, what is good and what to watch for at each hotel, what
 * could not be checked, and a way to make one of them the trip's stay.
 *
 * Every string in a report is plain text, some of it written from web pages:
 * it is only ever set as text, never as markdown or HTML, and nothing in it
 * becomes a link. The only links are the report's own https URL fields.
 */
const HotelComparisonCard: Component<HotelComparisonCardProps> = (props) => {
  const [busy, setBusy] = createSignal<number | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [picking, setPicking] = createSignal<number | null>(null);
  const [addedHere, setAddedHere] = createSignal<StayAdded | undefined>();
  const added = () => props.added ?? addedHere();

  const hotels = () => props.report.hotels;
  const name = (i: number) => hotelName(hotels()[i], i);
  const isPick = (i: number) => props.report.recommendedIndex === i;
  const via = () => (props.proposal ? "proposal" : "picker");
  /** The city a hotel's stay would be saved under; empty when Loci doesn't know it. */
  const cityOf = (hotel: ComparedHotel) => hotel.stay?.cityName.trim() ?? "";
  const title = () => {
    const names = hotels()
      .map((_, i) => name(i))
      .join(" vs ");
    return props.report.cityName ? `${names} · ${props.report.cityName}` : names;
  };
  const sources = () => props.report.sources.filter((s) => https(s.url));

  onMount(() => trackHotelReportShown(props.source, props.report, Boolean(props.proposal)));

  const done = (i: number, tripId: string, trip: Trip | undefined) => {
    const result: StayAdded = { tripId, tripTitle: trip?.title || undefined, hotelName: name(i) };
    trackHotelStaySet(props.source, via(), isPick(i), hotels()[i].identified);
    setAddedHere(result);
    setPicking(null);
    props.onAdded?.(result, trip);
  };

  /** Option `i` of the server's proposal, against the trip as it now stands. */
  const applyProposal = async (proposal: ActionProposal, i: number) => {
    const api = props.actionApi ?? tripActionApi;
    const held = props.tripVersion;
    const version = async () =>
      held ?? (await (props.stayApi ?? stayWriter).fetchTrip(proposal.tripId)).version;
    try {
      let res;
      try {
        res = await api.apply(proposal.id, i, await version());
      } catch (err) {
        // The card read the version itself, so it can read it again; a
        // surface that holds the trip refetches it and the traveller retaps.
        if (!isVersionConflict(err) || held !== undefined) throw err;
        res = await api.apply(proposal.id, i, await version());
      }
      done(i, proposal.tripId, res.trip ? mapTrip(res.trip) : undefined);
    } catch (err) {
      setError(tripActionErrorMessage(err));
      if (isVersionConflict(err)) props.onConflict?.(proposal.tripId);
    }
  };

  const add = async (i: number) => {
    if (busy() !== null || added()) return;
    trackHotelAddTapped(props.source, via(), isPick(i));
    setError(null);
    const proposal = props.proposal;
    if (!proposal) {
      setPicking(i);
      return;
    }
    setBusy(i);
    await applyProposal(proposal, i);
    setBusy(null);
  };

  const pickTrip = async (i: number, trip: Trip) => {
    if (busy() !== null) return;
    setBusy(i);
    setError(null);
    const city = cityOf(hotels()[i]);
    try {
      const saved = await setStayFromReport(
        props.stayApi ?? stayWriter,
        trip.id,
        hotels()[i],
        city,
      );
      done(i, saved.id, saved);
    } catch (err) {
      setError(
        err instanceof CityNotOnTripError
          ? `${city} is no longer on that trip. Pick another.`
          : err instanceof ConnectError && err.code === Code.InvalidArgument && err.rawMessage
            ? err.rawMessage
            : `Couldn't add ${name(i)} to that trip. Try again.`,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div class="flex justify-start" data-testid="hotel-report">
      <section
        aria-label="Hotel comparison"
        class="w-full min-w-0 rounded-2xl bg-[var(--muse-agent-bubble)] px-4 py-3 text-[var(--muse-text)]"
        classList={{
          "max-w-[94%] sm:max-w-[440px]": !!props.compact,
          "sm:max-w-[640px]": !props.compact,
        }}
      >
        <h3 class="text-[15px] font-semibold leading-snug" data-testid="hotel-report-title">
          {title()}
        </h3>

        <Show when={props.report.verdict.trim()}>
          <p
            class="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed"
            data-testid="hotel-report-verdict"
          >
            {props.report.verdict}
          </p>
        </Show>

        {/* The table scrolls inside its own box, so three hotels on a phone
            never push the page sideways. */}
        <Show when={props.report.rows.length > 0}>
          <div class="mt-3 max-w-full overflow-x-auto" data-testid="hotel-report-table">
            <table class="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr>
                  <td />
                  <For each={hotels()}>
                    {(hotel, i) => (
                      <th scope="col" class="min-w-[8.5rem] px-2 pb-2 align-top font-semibold">
                        {name(i())}
                        <Show when={isPick(i())}>
                          <span
                            class="mt-1 block w-fit rounded-full bg-[var(--muse-user-bubble)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muse-user-text)]"
                            data-testid="hotel-report-pick"
                          >
                            Loci's pick
                          </span>
                        </Show>
                        <Show when={!hotel.identified}>
                          <span
                            class={`mt-1 block font-normal ${quiet}`}
                            data-testid="hotel-report-unmatched"
                          >
                            Not matched to a known hotel
                          </span>
                        </Show>
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={props.report.rows}>
                  {(row) => (
                    <tr class="border-t border-[var(--muse-pill)]">
                      <th
                        scope="row"
                        class="py-1.5 pr-2 align-top font-medium text-[var(--muse-text-secondary)]"
                      >
                        {row.label}
                      </th>
                      <For each={hotels()}>
                        {(_, i) => (
                          <td class="px-2 py-1.5 align-top">{row.values[i()] || "Not known"}</td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>

        <div class="mt-3 grid gap-3" classList={{ "sm:grid-cols-2": !props.compact }}>
          <For each={hotels()}>
            {(hotel, i) => {
              const partner = () => https(hotel.livePrice?.bookingUrl);
              const listing = () => {
                const url = https(hotel.stay?.bookingUrl);
                return url && url !== partner() ? url : undefined;
              };
              return (
                <div class="min-w-0" data-testid="hotel-report-hotel">
                  <p class="text-sm font-semibold">{name(i())}</p>
                  <Show when={hotel.neighbourhood.trim()}>
                    <p class={`mt-1.5 ${label}`}>Area</p>
                    <p class="whitespace-pre-wrap text-[13px]">{hotel.neighbourhood}</p>
                  </Show>
                  <Show when={hotel.pros.length > 0}>
                    <p class={`mt-1.5 ${label}`}>Good</p>
                    <ul class="list-disc pl-4 text-[13px]">
                      <For each={hotel.pros}>{(pro) => <li>{pro}</li>}</For>
                    </ul>
                  </Show>
                  <Show when={hotel.cons.length > 0}>
                    <p class={`mt-1.5 ${label}`}>Watch out</p>
                    <ul class="list-disc pl-4 text-[13px]">
                      <For each={hotel.cons}>{(con) => <li>{con}</li>}</For>
                    </ul>
                  </Show>
                  <Show when={partner() || listing()}>
                    <p class="mt-1.5 flex flex-wrap gap-x-3 text-[13px]">
                      <Show when={partner()}>
                        {(url) => (
                          <a
                            class={linkClass}
                            href={url()}
                            target="_blank"
                            rel="sponsored noopener noreferrer"
                          >
                            Check availability
                            <span class="sr-only"> for {name(i())} (opens partner site)</span>
                          </a>
                        )}
                      </Show>
                      <Show when={listing()}>
                        {(url) => (
                          <a
                            class={linkClass}
                            href={url()}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open listing
                            <span class="sr-only"> for {name(i())} (opens in a new tab)</span>
                          </a>
                        )}
                      </Show>
                    </p>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

        <Show when={props.report.caveats.length > 0}>
          <p class={`mt-3 ${label}`}>What I couldn't check</p>
          <ul class="list-disc pl-4 text-[13px]" data-testid="hotel-report-caveats">
            <For each={props.report.caveats}>{(caveat) => <li>{caveat}</li>}</For>
          </ul>
        </Show>

        <Show when={sources().length > 0}>
          <p class={`mt-3 ${label}`}>Sources</p>
          <ul class="text-[13px]" data-testid="hotel-report-sources">
            <For each={sources()}>
              {(s) => (
                <li>
                  <a class={linkClass} href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title.trim() || s.publisher.trim() || "Source"}
                  </a>
                  <Show when={s.title.trim() && s.publisher.trim()}>
                    <span class="text-[var(--muse-text-secondary)]"> — {s.publisher}</span>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Show>

        <Show when={error()}>
          <p
            role="alert"
            class="mt-3 text-[13px] text-destructive"
            data-testid="hotel-report-error"
          >
            {error()}
          </p>
        </Show>

        <Show
          when={added()}
          fallback={
            <>
              <div class="mt-3 flex flex-wrap gap-2">
                <For each={hotels()}>
                  {(hotel, i) => (
                    <Show
                      when={hotel.stay && cityOf(hotel)}
                      fallback={
                        <p class={`w-full ${quiet}`} data-testid="hotel-report-no-city">
                          Loci doesn't know which city {name(i())} is in, so it can't go on a trip
                          from here.
                        </p>
                      }
                    >
                      <button
                        type="button"
                        data-testid="hotel-report-add"
                        disabled={busy() !== null}
                        onClick={() => void add(i())}
                        class={isPick(i()) || hotels().length === 1 ? primary : secondary}
                      >
                        {busy() === i() ? "Adding…" : `Add ${name(i())} to trip`}
                      </button>
                    </Show>
                  )}
                </For>
              </div>
              {/* Wrapped, because index 0 is a hotel too and would read as "no pick". */}
              <Show when={picking() !== null ? { i: picking()! } : undefined} keyed>
                {(pick) => (
                  <TripPicker
                    city={cityOf(hotels()[pick.i])}
                    hotel={name(pick.i)}
                    busy={busy() !== null}
                    tripsSource={props.tripsSource}
                    onPick={(trip) => void pickTrip(pick.i, trip)}
                    onPlanTrip={
                      props.onPlanTrip
                        ? () => {
                            const city = cityOf(hotels()[pick.i]);
                            props.onPlanTrip?.(`Plan a trip to ${city}`, city);
                          }
                        : undefined
                    }
                    onCancel={() => setPicking(null)}
                  />
                )}
              </Show>
            </>
          }
        >
          {(a) => (
            <p class="mt-3 text-sm font-medium" data-testid="hotel-report-added">
              {a().hotelName} is now the stay on {a().tripTitle ?? "your trip"}.{" "}
              <a
                class={linkClass}
                href={`/trips/${encodeURIComponent(a().tripId)}`}
                onClick={() => props.onNavigate?.()}
              >
                View trip
              </a>
            </p>
          )}
        </Show>

        <Show when={props.report.attribution.trim()}>
          <p class="mt-3 text-[11px] text-[var(--muse-text-secondary)]">
            {props.report.attribution}
          </p>
        </Show>
      </section>
    </div>
  );
};

export default HotelComparisonCard;
