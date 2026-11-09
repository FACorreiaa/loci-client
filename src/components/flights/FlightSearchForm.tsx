import { For, Show, createSignal, type JSX } from "solid-js";
import { ConnectError } from "@connectrpc/connect";
import { Button } from "~/ui/button";
import type { FlightCabinName, FlightLink, FlightPlace } from "~/lib/api/trips";
import type { FlightSearch, PlanApi } from "~/lib/api/trip-plan";
import { trackFlightBuilt, trackFlightClicked, type FlightSource } from "~/lib/flights/analytics";
import AirportField from "./AirportField";

const field = "w-full rounded-md border border-input bg-background px-2 py-1 text-sm";
const link = "text-sm text-primary underline-offset-2 hover:underline";

/** Links come from the server, but only https ones ever become an href. */
export const httpsOnly = (links: FlightLink[]) => links.filter((l) => l.url.startsWith("https://"));

/** rel for a partner link: sponsored only when it carries an affiliate tag. */
export const linkRel = (l: FlightLink) =>
  l.sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer";

export interface FlightSearchFormProps {
  source: FlightSource;
  api: PlanApi;
  /** Field values to start from; the destination usually comes resolved. */
  initial?: {
    fromText?: string;
    from?: FlightPlace;
    toText?: string;
    to?: FlightPlace;
    departDate?: string;
    returnDate?: string;
  };
  /** data-testid prefix: "flight" by default, "plan" in the trip panel. */
  testIdPrefix?: string;
  /** Shown beside the links once a search is built (the panel's Save). */
  extraActions?: (search: FlightSearch) => JSX.Element;
  onBuilt?: (links: FlightLink[], search: FlightSearch) => void;
}

/**
 * The flight search fields, shared by the trip plan panel and the Find
 * flights dialog: from, to, dates, travellers, cabin. It builds partner
 * search links on the server (no prices) and counts what it does.
 */
export default function FlightSearchForm(props: FlightSearchFormProps) {
  const id = (s: string) => `${props.testIdPrefix ?? "flight"}-${s}`;
  const init = props.initial ?? {};
  const [fromText, setFromText] = createSignal(init.fromText ?? init.from?.name ?? "");
  const [from, setFrom] = createSignal<FlightPlace>(init.from ?? { name: init.fromText ?? "" });
  const [toText, setToText] = createSignal(init.toText ?? init.to?.name ?? "");
  const [to, setTo] = createSignal<FlightPlace>(init.to ?? { name: init.toText ?? "" });
  const [depart, setDepart] = createSignal(init.departDate ?? "");
  const [ret, setRet] = createSignal(init.returnDate ?? "");
  const [pax, setPax] = createSignal(1);
  const [cabin, setCabin] = createSignal<FlightCabinName | "">("");
  const [links, setLinks] = createSignal<FlightLink[]>([]);
  const [built, setBuilt] = createSignal<FlightSearch>();
  const [error, setError] = createSignal<string | null>(null);

  const search = (): FlightSearch => ({
    origin: { ...from(), name: from().name.trim() },
    destination: { ...to(), name: to().name.trim() },
    departDate: depart(),
    returnDate: ret() || undefined,
    passengers: pax(),
    cabin: cabin() || undefined,
  });
  const ready = () =>
    from().name.trim() !== "" &&
    to().name.trim() !== "" &&
    depart() !== "" &&
    (!ret() || ret() >= depart());

  const buildLinks = async () => {
    setError(null);
    const s = search();
    try {
      const got = await props.api.buildLinks(s);
      setLinks(got);
      setBuilt(s);
      trackFlightBuilt(props.source, s);
      props.onBuilt?.(got, s);
    } catch (err) {
      setError(
        err instanceof ConnectError && err.rawMessage
          ? err.rawMessage
          : "Couldn't build the flight search.",
      );
    }
  };

  return (
    <div>
      <div class="grid gap-2 sm:grid-cols-2">
        <AirportField
          class={field}
          label="From"
          placeholder="From (city or airport)"
          testId={id("from")}
          text={fromText()}
          onChange={(text, place) => {
            setFromText(text);
            setFrom(place);
          }}
          search={(q) => props.api.searchAirports(q)}
        />
        <AirportField
          class={field}
          label="To"
          placeholder="To"
          testId={id("to")}
          text={toText()}
          onChange={(text, place) => {
            setToText(text);
            setTo(place);
          }}
          search={(q) => props.api.searchAirports(q)}
        />
        <input
          type="date"
          aria-label="Departure date"
          class={field}
          data-testid={id("depart")}
          value={depart()}
          onInput={(e) => setDepart(e.currentTarget.value)}
        />
        <input
          type="date"
          aria-label="Return date"
          class={field}
          data-testid={id("return")}
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
          data-testid={props.testIdPrefix === "plan" ? "plan-links" : id("search")}
          disabled={!ready()}
          onClick={buildLinks}
        >
          Search flights
        </Button>
        <For each={httpsOnly(links())}>
          {(l) => (
            <a
              class={link}
              href={l.url}
              target="_blank"
              rel={linkRel(l)}
              data-testid={id("link")}
              onClick={() => trackFlightClicked(props.source, l, built())}
            >
              {l.label}
            </a>
          )}
        </For>
        <Show when={links().length > 0 && built() && props.extraActions}>
          {props.extraActions!(built()!)}
        </Show>
      </div>
      <Show when={error()}>
        <p class="mt-1 text-xs text-destructive" role="alert">
          {error()}
        </p>
      </Show>
      <p class="mt-1 text-xs text-muted-foreground">
        Prices are on the airline sites; Loci only builds your search.
      </p>
    </div>
  );
}
