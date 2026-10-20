import { For, Show, createSignal } from "solid-js";
import { A } from "@solidjs/router";
import { Sparkles } from "lucide-solid";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/ui/dialog";
import { matchLabel, type TasteMatchView } from "~/lib/taste/match";

/**
 * "87% match": how well a place fits the traveller's taste. Tapping it opens
 * the reasons behind the number, and a way to correct what Loci has learned.
 * It sits inside clickable cards, so it never lets the click reach them.
 */
export default function MatchChip(props: { match: TasteMatchView; name?: string }) {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        class="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent hover:bg-accent/25"
        aria-label={`${matchLabel(props.match)} — why it fits you`}
      >
        <Sparkles class="h-3 w-3" aria-hidden="true" />
        {matchLabel(props.match)}
      </button>
      <Dialog open={open()} onOpenChange={setOpen}>
        <DialogContent onClick={(e: MouseEvent) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Why it fits you</DialogTitle>
          </DialogHeader>
          <p class="text-sm text-muted-foreground">
            <Show when={props.name} fallback="This place">
              {props.name}
            </Show>{" "}
            is a {matchLabel(props.match)} for your taste.
          </p>
          <Show
            when={props.match.reasons.length > 0}
            fallback={
              <p class="text-sm text-muted-foreground">
                Loci scored it from the places you've saved, visited and rated.
              </p>
            }
          >
            <ul class="space-y-2 text-sm text-foreground">
              <For each={props.match.reasons}>
                {(reason) => (
                  <li class="flex items-start gap-2">
                    <Sparkles class="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                    {reason}
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <A
            href="/settings?tab=memory"
            class="text-sm font-medium text-accent hover:underline"
            onClick={() => setOpen(false)}
          >
            Not quite? Tell Loci
          </A>
        </DialogContent>
      </Dialog>
    </>
  );
}
