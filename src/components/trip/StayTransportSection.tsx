import { For, Show, createEffect, on, onCleanup, onMount } from "solid-js";
import {
  StayTransportStatus,
  TransitMode,
  type DayStart,
  type StayTransport,
  type TransitStop,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { useStayTransport } from "~/lib/api/trip-plan";
import {
  trackStayDirectionsOpened,
  trackStayTransportViewed,
  type StayTransportSource,
} from "~/lib/hotels/analytics";
import { httpsUrl } from "./DayStartLine";

const MODE: Record<number, string> = {
  [TransitMode.METRO]: "Metro",
  [TransitMode.TRAIN]: "Train",
  [TransitMode.TRAM]: "Tram",
  [TransitMode.BUS]: "Bus",
  [TransitMode.FERRY]: "Ferry",
};

const label = "font-coord text-[11px] uppercase tracking-[0.16em] text-muted-foreground";

/** "Lesseps · L3 · 9 min walk (estimate)": what is there, never when it runs. */
export const stopLine = (stop: TransitStop): string => {
  const parts = [stop.name.trim() || "Unnamed stop"];
  if (stop.lines.length > 0) parts.push(stop.lines.join(", "));
  if (stop.walkMinutes > 0) {
    parts.push(`${stop.walkMinutes} min walk${stop.routed ? "" : " (estimate)"}`);
  }
  return parts.join(" · ");
};

export interface StayTransportSectionProps {
  transport: StayTransport;
  /** The stay as the trip names it; the transport's own name is the fallback. */
  stayName?: string;
  source: StayTransportSource;
  /** Names this stay to the view counter, so a redraw is not a second view. Never sent. */
  viewKey?: string;
}

/**
 * How to get around from one stay: the public transport stops near it and the
 * way to the airport. Stops come from OpenStreetMap and say what is there, not
 * when it runs. Each day's own "from your hotel" line sits with the day.
 */
export default function StayTransportSection(props: StayTransportSectionProps) {
  const t = () => props.transport;
  const name = () => props.stayName || t().stayName || "your stay";
  const noCoordinates = () => t().status === StayTransportStatus.NO_COORDINATES;
  const unavailable = () => t().status === StayTransportStatus.UNAVAILABLE;
  const airportUrl = () => httpsUrl(t().airport?.googleDirectionsUrl);

  onMount(() => trackStayTransportViewed(props.source, t(), props.viewKey));

  return (
    <section
      class="loci-card mb-6 p-4 sm:p-5"
      aria-label={`Getting around from ${name()}`}
      data-testid="stay-transport"
    >
      <h2 class="font-display text-lg font-semibold">Getting around from {name()}</h2>
      <Show
        when={!noCoordinates()}
        fallback={
          <p class="mt-2 text-sm text-muted-foreground" data-testid="stay-transport-note">
            We don't know where this stay is, so there's nothing to measure from.
          </p>
        }
      >
        <Show when={unavailable()}>
          <p class="mt-2 text-sm text-muted-foreground" data-testid="stay-transport-note">
            Nearby stops couldn't be loaded.
          </p>
        </Show>
        <Show when={!unavailable() && t().stops.length === 0}>
          <p class="mt-2 text-sm text-muted-foreground" data-testid="stay-transport-note">
            No stops mapped nearby.
          </p>
        </Show>
        <Show when={!unavailable() && t().stops.length > 0}>
          <ul class="mt-3 space-y-1.5">
            <For each={t().stops}>
              {(stop) => (
                <li class="flex gap-3 text-sm" data-testid="stay-transport-stop">
                  <span class={`w-14 shrink-0 pt-0.5 ${label}`}>{MODE[stop.mode] ?? "Stop"}</span>
                  <span class="min-w-0">{stopLine(stop)}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
        <Show when={t().airport}>
          {(airport) => (
            <p class="mt-1.5 flex gap-3 text-sm" data-testid="stay-transport-airport">
              <span class={`w-14 shrink-0 pt-0.5 ${label}`}>Airport</span>
              <span class="min-w-0">
                {airport().iata || airport().airportName}
                <Show when={airport().distanceKm > 0}>
                  {" "}
                  · {Math.round(airport().distanceKm)} km
                </Show>
                <Show when={airportUrl()}>
                  {(url) => (
                    <>
                      {" · "}
                      <a
                        class="no-print font-medium text-primary underline-offset-2 hover:underline"
                        href={url()}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackStayDirectionsOpened(props.source, "airport")}
                      >
                        Directions
                        <span class="sr-only"> to the airport (opens Google Maps)</span>
                      </a>
                    </>
                  )}
                </Show>
              </span>
            </p>
          )}
        </Show>
        <p class="mt-3 text-[11px] text-muted-foreground">
          <Show when={t().attribution.trim()}>{t().attribution} </Show>
          No live timetables.
        </p>
      </Show>
    </section>
  );
}

/**
 * The section for one city's stay, loaded on its own: the stops come from a
 * slow map service, so they never ride on the trip itself. Renders nothing
 * when the city has no stay, the server does not know the call, or it failed.
 * `onDayStarts` hands the page each day's "from your hotel" line.
 */
export function TripStayTransport(props: {
  tripId: string;
  cityName: string;
  stayName: string;
  version: bigint;
  source: StayTransportSource;
  onDayStarts?: (cityName: string, starts: DayStart[] | undefined) => void;
}) {
  const query = useStayTransport(() => ({
    tripId: props.tripId,
    cityName: props.cityName,
    version: props.version,
  }));
  // Guarded: reading `.data` of a pending query suspends the whole route.
  const transport = () => {
    if (query.isPending || query.isError) return undefined;
    const data = query.data ?? undefined;
    // The last answer stands in while a new trip version loads, unless the
    // stay itself changed: another hotel's stops are not this one's.
    if (data && query.isPlaceholderData && data.stayName !== props.stayName) return undefined;
    return data;
  };

  createEffect(
    on(transport, (t) => props.onDayStarts?.(props.cityName, t ? [...t.dayStarts] : undefined)),
  );
  onCleanup(() => props.onDayStarts?.(props.cityName, undefined));

  return (
    <Show when={transport()} keyed>
      {(t) => (
        <StayTransportSection
          transport={t}
          stayName={props.stayName}
          source={props.source}
          viewKey={`${props.tripId}:${props.cityName}`}
        />
      )}
    </Show>
  );
}
