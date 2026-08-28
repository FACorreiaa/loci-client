import { For, Show } from "solid-js";
import { Banknote } from "lucide-solid";
import { useDriveCost, useFxRates } from "~/lib/api/localContext";

interface TripMoneyProps {
  /** Destination coordinates; the server resolves the currency from them. */
  latitude?: number;
  longitude?: number;
  /** Total driving distance for the trip, if any. Omit to hide the fuel line. */
  driveKm?: number;
}

const fmtRate = (n: number) =>
  // Rates span 0.85 (GBP) to 185 (JPY); a fixed precision makes one of those
  // useless, so scale it to the magnitude.
  n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(2) : n.toFixed(4);

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/**
 * What the traveller's money is worth at the destination, and what the driving
 * costs.
 *
 * Renders nothing at all when there is neither a rate nor a drive — an empty
 * "Money" card is worse than no card.
 */
export default function TripMoney(props: TripMoneyProps) {
  const fx = useFxRates(() =>
    props.latitude != null && props.longitude != null
      ? { lat: props.latitude, lon: props.longitude }
      : undefined,
  );
  const drive = useDriveCost(() => props.driveKm);

  const rates = () => fx.data?.rates ?? [];
  const unsupported = () => fx.data?.unsupported ?? [];
  const hasAnything = () => rates().length > 0 || unsupported().length > 0 || !!drive.data;

  return (
    <Show when={hasAnything()}>
      <div class="loci-card p-3">
        <p class="ui-label mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Banknote size={13} aria-hidden="true" />
          Money
        </p>

        <For each={rates()}>
          {(r) => (
            <p class="text-sm tabular-nums">
              1 {r.base} = <span class="font-medium">{fmtRate(r.rate)}</span> {r.quote}
              {/* The ECB publishes once a working day, so a Friday rate read on
                  a Sunday should visibly be a Friday rate. */}
              <Show when={fmtDate(r.asOf)}>
                {(d) => <span class="ml-1.5 text-xs text-muted-foreground">as of {d()}</span>}
              </Show>
            </p>
          )}
        </For>

        {/* Naming what we could not price beats showing nothing, which is
            indistinguishable from the feature being broken. */}
        <For each={unsupported()}>
          {(code) => <p class="text-xs text-muted-foreground">No published rate for {code}</p>}
        </For>

        <Show when={drive.data}>
          {(d) => (
            <div class="mt-2 border-t border-border pt-2">
              <p class="text-sm tabular-nums">
                Fuel ≈{" "}
                <span class="font-medium">
                  {d().cost.toFixed(2)} {d().currency}
                </span>
                <span class="ml-1.5 text-xs text-muted-foreground">
                  {Math.round(d().distanceKm)} km · {d().litres.toFixed(1)} L
                </span>
              </p>
              {/* Always shown: a bare figure about someone's money invites
                  either misplaced trust or dismissal, and only the assumptions
                  let them correct it against their own car. */}
              <p class="mt-0.5 text-[0.65rem] leading-snug text-muted-foreground">
                {d().assumptions}
              </p>
            </div>
          )}
        </Show>
      </div>
    </Show>
  );
}
