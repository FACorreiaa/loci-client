import { Show } from "solid-js";
import { AlertCircle, CheckCircle2, Clock, ShieldCheck } from "lucide-solid";
import type { ClaimStatus } from "~/lib/api/place-intelligence";

/**
 * What happened to the report just filed.
 *
 * The page used to say "Report received" whatever the outcome, which left the
 * obvious question unanswered: why is my report not on the place yet? A fact
 * needs two independent scouts, so a first report is genuinely half a fact, and
 * saying so is the difference between a queue and a void.
 */
export function ClaimResult(props: { status: ClaimStatus }) {
  const verified = () => props.status === "ACCEPTED";
  const contradicted = () => props.status === "CONTRADICTED";

  return (
    <div class="mt-4 rounded-lg border border-border bg-secondary/50 p-4 text-center">
      <Show when={verified()}>
        <ShieldCheck class="mx-auto h-6 w-6 text-accent" />
        <p class="mt-2 text-sm font-semibold text-accent">Verified.</p>
        <p class="mt-1 text-xs text-muted-foreground">
          Another scout saw the same thing. This is on the field guide now.
        </p>
      </Show>

      <Show when={contradicted()}>
        <AlertCircle class="mx-auto h-6 w-6 text-muted-foreground" />
        <p class="mt-2 text-sm font-semibold">Noted — reports differ.</p>
        <p class="mt-1 text-xs text-muted-foreground">
          Another scout saw something different. We will wait for a third look.
        </p>
      </Show>

      <Show when={!verified() && !contradicted()}>
        <Show
          when={props.status === "PENDING"}
          fallback={<CheckCircle2 class="mx-auto h-6 w-6 text-muted-foreground" />}
        >
          <Clock class="mx-auto h-6 w-6 text-muted-foreground" />
        </Show>
        <p class="mt-2 text-sm font-semibold">Recorded.</p>
        <p class="mt-1 text-xs text-muted-foreground">
          One more scout needs to see the same thing before it goes live.
        </p>
        <div class="mx-auto mt-3 flex w-16 gap-1" aria-hidden="true">
          <span class="h-1 flex-1 rounded-full bg-accent" />
          <span class="h-1 flex-1 rounded-full bg-border" />
        </div>
        <p class="mt-1 font-coord text-[10px] uppercase tracking-wider text-muted-foreground">
          1 of 2 scouts
        </p>
      </Show>
    </div>
  );
}
