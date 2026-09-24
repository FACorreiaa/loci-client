import { Bus, Car, Plane, TrainFront } from "lucide-solid";
import type { RouteLeg } from "~/lib/streaming/chatStream";
import { formatLeg } from "./multi-city-view";

const ICON = { drive: Car, train: TrainFront, bus: Bus, flight: Plane } as const;

/** Travel between two cities of a trip. An estimate from distance, and labelled one. */
export function LegRow(props: { leg: RouteLeg }) {
  const Icon = () => {
    const C = ICON[props.leg.mode as keyof typeof ICON] ?? Car;
    return <C class="h-4 w-4 flex-shrink-0" aria-hidden="true" />;
  };
  return (
    <div
      class="my-4 flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm"
      role="note"
    >
      <Icon />
      <span class="font-medium">
        {props.leg.fromName} → {props.leg.toName}
      </span>
      <span class="text-muted-foreground">{formatLeg(props.leg)}</span>
      <span class="ml-auto text-xs text-muted-foreground">Estimate</span>
    </div>
  );
}
