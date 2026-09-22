import { Show } from "solid-js";
import { HelpCircle } from "lucide-solid";
import { type PendingPlace, useConfirmPlace } from "~/lib/api/place-intelligence";
import { Button } from "~/ui/button";

export interface ConfirmOutcome {
  promoted: boolean;
}

/**
 * "Does this place exist?" — the other half of somebody's submission.
 *
 * The outcome lives with the caller, not in here: confirming drops the place
 * from the pending feed, which unmounts this card, and a result held locally
 * would vanish before anyone could read it.
 */
export function PendingPlaceCard(props: {
  place: PendingPlace;
  outcome?: ConfirmOutcome;
  onConfirmed: (outcome: ConfirmOutcome) => void;
}) {
  const confirm = useConfirmPlace();

  const onConfirm = () =>
    confirm
      .mutateAsync(props.place.submissionId)
      .then((result) => props.onConfirmed({ promoted: result.promoted }))
      .catch(() => undefined);

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
        when={props.outcome}
        fallback={
          <>
            <Button class="mt-4 w-full" disabled={confirm.isPending} onClick={onConfirm}>
              {confirm.isPending ? "Confirming…" : "Yes, it exists"}
            </Button>
            <Show when={confirm.isError}>
              <p class="mt-2 text-sm text-destructive">That did not go through. Try again.</p>
            </Show>
          </>
        }
      >
        {(outcome) => (
          <p class="mt-4 text-sm text-accent">
            {outcome().promoted
              ? "Confirmed. It is on the guide now."
              : "Thanks — still waiting on one more scout."}
          </p>
        )}
      </Show>
    </div>
  );
}

export default PendingPlaceCard;
