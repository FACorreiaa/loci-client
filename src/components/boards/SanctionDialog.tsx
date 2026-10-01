import { createEffect, createSignal, For } from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/ui/dialog";
import { Button } from "~/ui/button";
import { TextArea } from "~/ui/textarea";
import { TextFieldRoot } from "~/ui/textfield";
import { Label } from "~/ui/label";
import { boardsErrorMessage, useSanctionUser, type SanctionKindName } from "~/lib/api/boards";
import type { PublicUser } from "~/lib/api/social";
import { showToast } from "~/lib/toast-store";
import { cn } from "~/lib/utils";

const DURATIONS = [
  { label: "1 day", days: 1 },
  { label: "1 week", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Permanent", days: 0 },
] as const;

export interface SanctionTarget {
  user: PublicUser;
  kind: SanctionKindName;
}

/** Admin: mute or ban someone from boards, for a while or for good. */
export default function SanctionDialog(props: { target?: SanctionTarget; onClose: () => void }) {
  const sanction = useSanctionUser();
  const [kind, setKind] = createSignal<SanctionKindName>("mute");
  const [days, setDays] = createSignal(7);
  const [reason, setReason] = createSignal("");

  createEffect(() => {
    if (props.target) {
      setKind(props.target.kind);
      setDays(props.target.kind === "ban" ? 0 : 7);
      setReason("");
    }
  });

  const submit = async () => {
    const t = props.target;
    if (!t) return;
    try {
      await sanction.mutateAsync({
        userId: t.user.id,
        kind: kind(),
        reason: reason().trim(),
        days: days() || undefined,
      });
      showToast({
        id: "boards-sanction",
        title: `${t.user.displayName} ${kind() === "ban" ? "banned" : "muted"}.`,
      });
      props.onClose();
    } catch (err) {
      showToast({ id: "boards-sanction", title: boardsErrorMessage(err) });
    }
  };

  return (
    <Dialog open={!!props.target} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Moderate {props.target?.user.displayName}</DialogTitle>
          <DialogDescription>
            A mute stops them posting, commenting and voting. A ban also hides everything they wrote
            until it is lifted.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sanction">
            <For each={["mute", "ban"] as const}>
              {(k) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={kind() === k}
                  class={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium capitalize",
                    kind() === k ? "border-primary bg-primary/10 text-primary" : "border-border",
                  )}
                  onClick={() => setKind(k)}
                >
                  {k}
                </button>
              )}
            </For>
          </div>

          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Duration">
            <For each={DURATIONS}>
              {(d) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={days() === d.days}
                  class={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    days() === d.days
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border",
                  )}
                  onClick={() => setDays(d.days)}
                >
                  {d.label}
                </button>
              )}
            </For>
          </div>

          <TextFieldRoot>
            <Label class="mb-2 block">Reason (only admins see it)</Label>
            <TextArea
              value={reason()}
              onInput={(e) => setReason(e.currentTarget.value.slice(0, 500))}
              rows={2}
            />
          </TextFieldRoot>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            variant={kind() === "ban" ? "destructive" : "default"}
            disabled={sanction.isPending}
            onClick={submit}
          >
            {kind() === "ban" ? "Ban" : "Mute"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
