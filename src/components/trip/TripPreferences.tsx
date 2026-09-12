import { For, Show } from "solid-js";
import { SlidersHorizontal } from "lucide-solid";
import { TripPace } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/ui/accordion";
import { Badge } from "~/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "~/ui/toggle-group";
import { BUDGET_LABELS, PACE_LABELS, hhmmToMinutes, minutesToHHMM } from "~/lib/trip-format";
import type { TripConstraint } from "~/lib/api/trips";

export interface TripPreferencesProps {
  constraints: TripConstraint;
  onChange: (patch: Partial<TripConstraint>) => void;
}

const fieldInput =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const PACE_OPTIONS = [TripPace.RELAXED, TripPace.MODERATE, TripPace.PACKED];

/**
 * Trip-wide constraints, collapsed by default.
 *
 * These are set once and then rarely touched, so leaving five form controls
 * permanently open above the itinerary cost more attention than it earned.
 * The collapsed trigger still states every current value.
 */
export default function TripPreferences(props: TripPreferencesProps) {
  const paceLabel = () => PACE_LABELS[props.constraints.pace] ?? "—";
  const budgetLabel = () =>
    props.constraints.budgetLevel ? BUDGET_LABELS[props.constraints.budgetLevel] : undefined;
  const dayWindow = () => {
    const start = minutesToHHMM(props.constraints.dayStartMinute);
    const end = minutesToHHMM(props.constraints.dayEndMinute);
    return start || end ? `${start || "—"}–${end || "—"}` : undefined;
  };

  return (
    <Accordion collapsible class="loci-card mb-8 px-4">
      <AccordionItem value="preferences" class="border-b-0">
        <AccordionTrigger class="gap-3">
          <span class="flex flex-wrap items-center gap-2">
            <span class="font-coord inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <SlidersHorizontal class="h-3.5 w-3.5" aria-hidden="true" />
              Trip preferences
            </span>
            <Badge variant="outline">{paceLabel()}</Badge>
            <Show when={budgetLabel()}>{(b) => <Badge variant="outline">{b()}</Badge>}</Show>
            <Show when={props.constraints.mobility}>
              {(m) => <Badge variant="outline">{m()}</Badge>}
            </Show>
            <Show when={dayWindow()}>
              {(w) => (
                <Badge variant="outline" class="font-coord tabular-nums">
                  {w()}
                </Badge>
              )}
            </Show>
          </span>
        </AccordionTrigger>

        <AccordionContent>
          <div class="flex flex-wrap gap-6 text-foreground">
            <div>
              <p class="ui-label mb-1.5 block text-[11px] text-muted-foreground">Pace</p>
              <ToggleGroup
                variant="outline"
                class="justify-start"
                value={String(props.constraints.pace)}
                onChange={(value) => {
                  if (value != null) props.onChange({ pace: Number(value) });
                }}
              >
                <For each={PACE_OPTIONS}>
                  {(pace) => (
                    <ToggleGroupItem value={String(pace)} aria-label={PACE_LABELS[pace]}>
                      {PACE_LABELS[pace]}
                    </ToggleGroupItem>
                  )}
                </For>
              </ToggleGroup>
            </div>

            <div>
              <p class="ui-label mb-1.5 block text-[11px] text-muted-foreground">Budget</p>
              <ToggleGroup
                variant="outline"
                class="justify-start"
                value={props.constraints.budgetLevel ? String(props.constraints.budgetLevel) : null}
                onChange={(value) =>
                  props.onChange({ budgetLevel: value ? Number(value) : undefined })
                }
              >
                <For each={[1, 2, 3, 4]}>
                  {(level) => (
                    <ToggleGroupItem value={String(level)} aria-label={`Budget level ${level}`}>
                      {BUDGET_LABELS[level]}
                    </ToggleGroupItem>
                  )}
                </For>
              </ToggleGroup>
            </div>

            <label class="flex flex-col">
              <span class="ui-label mb-1.5 block text-[11px] text-muted-foreground">Mobility</span>
              <input
                type="text"
                class={`${fieldInput} w-44`}
                value={props.constraints.mobility ?? ""}
                placeholder="walking, transit…"
                onChange={(e) => props.onChange({ mobility: e.currentTarget.value })}
              />
            </label>

            <label class="flex flex-col">
              <span class="ui-label mb-1.5 block text-[11px] text-muted-foreground">
                Day starts
              </span>
              <input
                type="time"
                class={fieldInput}
                value={minutesToHHMM(props.constraints.dayStartMinute)}
                onChange={(e) =>
                  props.onChange({ dayStartMinute: hhmmToMinutes(e.currentTarget.value) })
                }
              />
            </label>

            <label class="flex flex-col">
              <span class="ui-label mb-1.5 block text-[11px] text-muted-foreground">Day ends</span>
              <input
                type="time"
                class={fieldInput}
                value={minutesToHHMM(props.constraints.dayEndMinute)}
                onChange={(e) =>
                  props.onChange({ dayEndMinute: hhmmToMinutes(e.currentTarget.value) })
                }
              />
            </label>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
