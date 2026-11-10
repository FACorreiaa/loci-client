import { For, Show, createSignal, type JSX } from "solid-js";
import { ConnectError } from "@connectrpc/connect";
import { ExternalLink, Loader2 } from "lucide-solid";
import { Button, buttonVariants } from "~/ui/button";
import { fieldControlClass } from "~/ui/textfield";
import { cn } from "~/lib/utils";
import type { FlightCabinName, FlightLink, FlightPlace } from "~/lib/api/trips";
import type { FlightSearch, PlanApi } from "~/lib/api/trip-plan";
import { trackFlightBuilt, trackFlightClicked, type FlightSource } from "~/lib/flights/analytics";
import AirportField from "./AirportField";

const field = fieldControlClass;
const fieldLabel = "mb-1 block text-xs font-medium text-muted-foreground";

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
  const [pending, setPending] = createSignal(false);

  const search = (): FlightSearch => ({
    origin: { ...from(), name: from().name.trim() },
    destination: { ...to(), name: to().name.trim() },
    departDate: depart(),
    returnDate: ret() || undefined,
    passengers: pax(),
    cabin: cabin() || undefined,
  });
  const returnBeforeDeparture = () => ret() !== "" && depart() !== "" && ret() < depart();
  const ready = () =>
    from().name.trim() !== "" &&
    to().name.trim() !== "" &&
    depart() !== "" &&
    !returnBeforeDeparture();

  const buildLinks = async () => {
    if (pending()) return;
    setError(null);
    setPending(true);
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
          : "Couldn't build the flight search. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <div class="grid gap-3 sm:grid-cols-2">
        <AirportField
          class={field}
          label="From"
          placeholder="City or airport"
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
          placeholder="City or airport"
          testId={id("to")}
          text={toText()}
          onChange={(text, place) => {
            setToText(text);
            setTo(place);
          }}
          search={(q) => props.api.searchAirports(q)}
        />
        <label class="block">
          <span class={fieldLabel}>Departure</span>
          <input
            type="date"
            class={field}
            data-testid={id("depart")}
            value={depart()}
            onInput={(e) => setDepart(e.currentTarget.value)}
          />
        </label>
        <label class="block">
          <span class={fieldLabel}>Return (optional)</span>
          <input
            type="date"
            class={field}
            data-testid={id("return")}
            value={ret()}
            min={depart()}
            aria-invalid={returnBeforeDeparture() ? true : undefined}
            onInput={(e) => setRet(e.currentTarget.value)}
          />
        </label>
        <label class="block">
          <span class={fieldLabel}>Travellers</span>
          <input
            type="number"
            inputmode="numeric"
            min="1"
            max="9"
            class={field}
            value={pax()}
            onInput={(e) => setPax(Math.min(9, Math.max(1, Number(e.currentTarget.value) || 1)))}
          />
        </label>
        <label class="block">
          <span class={fieldLabel}>Cabin</span>
          <select
            class={field}
            onChange={(e) => setCabin(e.currentTarget.value as FlightCabinName | "")}
          >
            <option value="">Any cabin</option>
            <option value="economy">Economy</option>
            <option value="premium_economy">Premium economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </select>
        </label>
      </div>
      <Show when={returnBeforeDeparture()}>
        <p class="mt-2 text-sm text-destructive" role="alert">
          The return date is before the departure. Pick a later return, or clear it for one way.
        </p>
      </Show>
      <div class="mt-4">
        <Button
          data-testid={props.testIdPrefix === "plan" ? "plan-links" : id("search")}
          disabled={!ready() || pending()}
          aria-busy={pending()}
          onClick={buildLinks}
        >
          <Show when={pending()} fallback="Search flights">
            <Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Building search…
          </Show>
        </Button>
      </div>
      <Show when={error()}>
        <p class="mt-2 text-sm text-destructive" role="alert">
          {error()}
        </p>
      </Show>
      <Show when={links().length > 0}>
        <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span class="mr-1 text-xs text-muted-foreground">Open on</span>
          <For each={httpsOnly(links())}>
            {(l) => (
              <a
                class={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  // An anchor misses the base rule that sizes buttons for touch.
                  "min-h-11 sm:min-h-0",
                )}
                href={l.url}
                target="_blank"
                rel={linkRel(l)}
                data-testid={id("link")}
                onClick={() => trackFlightClicked(props.source, l, built())}
              >
                {l.label}
                <ExternalLink class="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                <span class="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </For>
          <Show when={built() && props.extraActions}>{props.extraActions!(built()!)}</Show>
        </div>
      </Show>
      <p class="mt-3 text-xs text-muted-foreground">
        Prices are on the airline sites; Loci only builds your search.
      </p>
    </div>
  );
}
