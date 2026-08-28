import { For, Show } from "solid-js";
import { Layers } from "lucide-solid";
import { LOCI_ALERT_COLORS, LOCI_MAP_CLUSTER_COLOR } from "~/lib/theme-colors";
import { ToggleGroup, ToggleGroupItem } from "~/ui/toggle-group";

export interface LayerVisibility {
  stops: boolean;
  routes: boolean;
  alerts: boolean;
}

interface LayerLegendProps {
  value: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
  /** Hides the alerts row entirely when there is nothing located to show. */
  alertCount?: number;
}

const SEVERITY_KEY = [
  { label: "Minor", color: LOCI_ALERT_COLORS.minor },
  { label: "Moderate", color: LOCI_ALERT_COLORS.moderate },
  { label: "Major", color: LOCI_ALERT_COLORS.major },
];

/**
 * Layer toggles and a colour key for the map.
 *
 * Two things it deliberately does *not* do. It does not offer a layer per data
 * source — a traveller does not think in terms of "GDACS" and "USGS", they
 * think "hazards" — and it does not toggle layers the map is not currently
 * drawing, which is why the alert row disappears when nothing is located.
 *
 * A multi-select ToggleGroup rather than the radiogroup pattern in
 * GlobeControls: these layers stack, they are not alternatives.
 */
export default function LayerLegend(props: LayerLegendProps) {
  const hasAlerts = () => (props.alertCount ?? 0) > 0;

  const selected = () => {
    const v: string[] = [];
    if (props.value.stops) v.push("stops");
    if (props.value.routes) v.push("routes");
    if (props.value.alerts) v.push("alerts");
    return v;
  };

  const onSelectionChange = (next: string[]) => {
    props.onChange({
      stops: next.includes("stops"),
      routes: next.includes("routes"),
      alerts: next.includes("alerts"),
    });
  };

  return (
    <div class="island-panel pointer-events-auto w-max max-w-[15rem] p-3">
      <p class="ui-label mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Layers size={13} aria-hidden="true" />
        Layers
      </p>

      <ToggleGroup
        multiple
        size="sm"
        variant="outline"
        value={selected()}
        onChange={onSelectionChange}
        aria-label="Map layers"
        class="flex-wrap justify-start"
      >
        <ToggleGroupItem value="stops" aria-label="Show stops">
          Stops
        </ToggleGroupItem>
        <ToggleGroupItem value="routes" aria-label="Show routes">
          Routes
        </ToggleGroupItem>
        <Show when={hasAlerts()}>
          <ToggleGroupItem value="alerts" aria-label="Show alerts">
            Alerts
          </ToggleGroupItem>
        </Show>
      </ToggleGroup>

      {/* The colour key only earns its space while alerts are actually drawn. */}
      <Show when={hasAlerts() && props.value.alerts}>
        <div class="mt-3 border-t border-border pt-2">
          <p class="ui-label mb-1.5 text-[0.65rem] text-muted-foreground">Alert severity</p>
          <ul class="space-y-1">
            <For each={SEVERITY_KEY}>
              {(s) => (
                <li class="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    class="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ "background-color": s.color }}
                    aria-hidden="true"
                  />
                  {s.label}
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>

      <Show when={props.value.stops}>
        <div class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            class="inline-block size-2.5 shrink-0 rounded-full"
            style={{ "background-color": LOCI_MAP_CLUSTER_COLOR }}
            aria-hidden="true"
          />
          Itinerary stop
        </div>
      </Show>
    </div>
  );
}
