import { Show } from "solid-js";
import { HelpCircle } from "lucide-solid";
import { type PendingPlace, useConfirmPlace } from "~/lib/api/place-intelligence";
import { Button } from "~/ui/button";

/** "Does this place exist?" — the other half of somebody's submission. */
export function PendingPlaceCard(props: { place: PendingPlace }) {
  const confirm = useConfirmPlace();

  return (
    <div class="rounded-xl border border-border bg-card p-5">
      <div class="flex items-start gap-3">
        <HelpCircle class="mt-0.5 h-5 w-5 text-accent" />
        <div class="min-w-0 flex-1">
          <p class="font-coord text-[9px] uppercase tracking-wider text-muted-foreground">
            Does this place exist?
          </p>
          <h3 class="mt-1 text-lg">{props.place.name}</h3>
          <p class="mt-1 text-xs text-muted-foreground">
            {props.place.cityName}
            <Show when={props.place.category}>{(c) => <> · {c()}</>}</Show>
          </p>
        </div>
      </div>

      <Show
        when={!confirm.isSuccess}
        fallback={
          <p class="mt-4 text-sm text-accent">
            {confirm.data?.promoted
              ? "Confirmed. It is on the guide now."
              : "Thanks — still waiting on one more scout."}
          </p>
        }
      >
        <Button
          class="mt-4 w-full"
          disabled={confirm.isPending}
          onClick={() => confirm.mutate(props.place.submissionId)}
        >
          {confirm.isPending ? "Confirming…" : "Yes, it exists"}
        </Button>
      </Show>
    </div>
  );
}

export default PendingPlaceCard;
