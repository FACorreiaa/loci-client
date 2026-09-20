import { For, Show } from "solid-js";
import { MapPin } from "lucide-solid";
import type { VerificationTask } from "~/lib/api/place-intelligence";
import { fieldLabel } from "~/lib/place-facts/vocabulary";
import { cn } from "~/lib/utils";

function fieldPreview(fields: string[]) {
  return {
    shown: fields.slice(0, 2),
    extra: Math.max(0, fields.length - 2),
  };
}

export function TaskCard(props: {
  task: VerificationTask;
  selected: boolean;
  onSelect: (task: VerificationTask) => void;
}) {
  const preview = () => fieldPreview(props.task.requestedFields.map(fieldLabel));

  return (
    <button
      type="button"
      onClick={() => props.onSelect(props.task)}
      aria-pressed={props.selected}
      class={cn(
        "loci-card-interactive motion-press w-full rounded-xl p-4 text-left",
        props.selected && "border-accent ring-2 ring-accent/15",
      )}
    >
      <div class="flex items-start gap-3">
        <MapPin class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-base font-semibold">{props.task.poiName}</h3>
          <p class="mt-1 flex flex-wrap items-center gap-1.5">
            <For each={preview().shown}>
              {(label) => (
                <span class="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
                  {label}
                </span>
              )}
            </For>
            <Show when={preview().extra > 0}>
              <span class="text-[11px] text-muted-foreground">+{preview().extra}</span>
            </Show>
          </p>
        </div>
        <span class="font-coord shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground">
          Verify
        </span>
      </div>
    </button>
  );
}
