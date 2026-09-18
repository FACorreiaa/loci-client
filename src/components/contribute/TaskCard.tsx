import { MapPin } from "lucide-solid";
import type { VerificationTask } from "~/lib/api/place-intelligence";
import { fieldLabel } from "~/lib/place-facts/vocabulary";

export function TaskCard(props: {
  task: VerificationTask;
  selected: boolean;
  onSelect: (task: VerificationTask) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onSelect(props.task)}
      class={`w-full rounded-xl border bg-card p-5 text-left transition hover:border-accent ${props.selected ? "border-accent ring-2 ring-accent/15" : "border-border"}`}
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex gap-3">
          <MapPin class="mt-0.5 h-5 w-5 text-accent" />
          <div>
            <h3 class="text-lg">{props.task.poiName}</h3>
            <p class="mt-1 text-xs text-muted-foreground">
              Needs {props.task.requestedFields.map(fieldLabel).join(", ")}
            </p>
          </div>
        </div>
        <span class="font-coord text-[9px] uppercase tracking-wider text-muted-foreground">
          Verify
        </span>
      </div>
    </button>
  );
}
