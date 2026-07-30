import { For, Show } from "solid-js";
import { ArrowRight, Car, Clock, Info, Lock, MapPin } from "lucide-solid";
import type { MultiCityPlan } from "@buf/loci_loci-proto.bufbuild_es/loci/compare/v1/compare_pb.js";

interface MultiCityPlanCardProps {
  plan: MultiCityPlan;
  /** Called with the plan when the user wants it saved as a trip. */
  onSave?: () => void;
  saving?: boolean;
}

const hours = (mins: number) => {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
};

const dayLabel = (dayNumbers: number[]) => {
  if (dayNumbers.length === 0) return "no days";
  if (dayNumbers.length === 1) return `day ${dayNumbers[0]}`;
  return `days ${dayNumbers[0]}–${dayNumbers[dayNumbers.length - 1]}`;
};

/**
 * A planned route through several cities over several days.
 *
 * Replaces the old "can you do these two in a weekend?" yes/no. The route is
 * shown with the things that justify it — each city's go-score, the day split,
 * the driving between them — and with what got left out and why, because a
 * planner that silently drops a city the user asked for is not trustworthy.
 */
export function MultiCityPlanCard(props: MultiCityPlanCardProps) {
  const plan = () => props.plan;
  const cities = () => plan().cities;

  return (
    <div class="loci-card p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="kicker mb-1">Your route</p>
          <Show
            when={plan().feasible && cities().length > 0}
            fallback={<p class="text-sm text-muted-foreground">{plan().outline}</p>}
          >
            <p class="font-display text-xl text-foreground">
              <For each={cities()}>
                {(city, i) => (
                  <>
                    <Show when={i() > 0}>
                      <ArrowRight
                        class="mx-1.5 inline h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Show>
                    {city.cityName}
                  </>
                )}
              </For>
            </p>
          </Show>
        </div>

        <Show when={plan().proOnly}>
          <span class="flex flex-shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Lock class="h-3 w-3" aria-hidden="true" />
            Pro
          </span>
        </Show>
      </div>

      <Show when={plan().feasible && cities().length > 0}>
        {/* Day split per city, each with the score that earned it a place. */}
        <ul class="mt-4 space-y-2">
          <For each={cities()}>
            {(city) => (
              <li class="flex items-baseline justify-between gap-3 text-sm">
                <span class="flex min-w-0 items-baseline gap-2">
                  <MapPin class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" aria-hidden="true" />
                  <span class="font-medium text-foreground">{city.cityName}</span>
                  <span class="text-muted-foreground">{dayLabel(city.dayNumbers)}</span>
                </span>
                <Show when={city.goScore}>
                  <span class="flex-shrink-0 tabular-nums text-muted-foreground">
                    {city.goScore!.score}/100
                  </span>
                </Show>
              </li>
            )}
          </For>
        </ul>

        {/* The driving, which is what makes or breaks a multi-city trip. */}
        <Show when={plan().legs.length > 0}>
          <ul class="mt-4 space-y-1.5 border-t border-border/60 pt-3">
            <For each={plan().legs}>
              {(leg) => (
                <li class="flex items-baseline gap-2 text-xs text-muted-foreground">
                  <Car class="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>
                    {leg.fromName} → {leg.toName} · {Math.round(leg.distanceKm)} km ·{" "}
                    {hours(leg.durationMins)}
                    {/* afterDay 0 is the outbound leg; proto3 omits the zero, so
                        an absent value means "before day 1". */}
                    {leg.afterDay ? ` · after day ${leg.afterDay}` : " · to start"}
                  </span>
                </li>
              )}
            </For>
          </ul>
        </Show>

        <p class="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock class="h-3.5 w-3.5" aria-hidden="true" />
          {hours(plan().totalTravelMins)} driving in total — {Math.round(plan().travelShare * 100)}%
          of the trip
        </p>
      </Show>

      <Show when={plan().warnings.length > 0}>
        <ul class="mt-3 space-y-1">
          <For each={plan().warnings}>
            {(warning) => (
              <li class="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info class="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{warning}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>

      {/* What we left out, and why. A planner that quietly drops a city the user
          asked about has not earned their trust. */}
      <Show when={plan().dropped.length > 0}>
        <div class="mt-4 border-t border-border/60 pt-3">
          <p class="kicker mb-1.5">Left out</p>
          <ul class="space-y-1">
            <For each={plan().dropped}>
              {(drop) => (
                <li class="text-xs text-muted-foreground">
                  <span class="font-medium text-foreground">{drop.cityName}</span> — {drop.reason}
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>

      <Show when={props.onSave && plan().feasible && !plan().proOnly}>
        <button
          type="button"
          class="loci-hero__action mt-4 w-full justify-center"
          disabled={props.saving}
          onClick={() => props.onSave?.()}
        >
          {props.saving ? "Saving…" : "Save this route as a trip"}
        </button>
      </Show>

      <Show when={plan().proOnly && plan().feasible}>
        <p class="mt-4 text-xs text-muted-foreground">
          Upgrade to Pro to save a multi-city route as an editable trip.
        </p>
      </Show>
    </div>
  );
}

export default MultiCityPlanCard;
