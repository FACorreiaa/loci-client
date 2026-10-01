import { For } from "solid-js";
import { AlertCircle, Clock, ShieldCheck } from "lucide-solid";
import type { MyClaim } from "~/lib/contribute/my-claims";

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

/**
 * "Your reports" — the scout's own claims and what became of each. A report
 * does not go live on its own, so the row's job is to say which ones are still
 * waiting on a second scout and which made it onto the guide.
 */
export function MyClaimsList(props: { claims: MyClaim[] }) {
  return (
    <ul class="grid gap-2">
      <For each={props.claims}>
        {(claim) => (
          <li class="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <StatusIcon claim={claim} />
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{claim.placeName}</p>
              <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {claim.fieldLabel} · {claim.value}
              </p>
              <p class="mt-1 font-coord text-[9px] uppercase tracking-wider text-muted-foreground">
                {claim.statusText}
                {claim.createdAt ? ` · ${dateFormat.format(claim.createdAt)}` : ""}
              </p>
            </div>
          </li>
        )}
      </For>
    </ul>
  );
}

function StatusIcon(props: { claim: MyClaim }) {
  const cls = "mt-0.5 h-5 w-5 shrink-0";
  if (props.claim.status === "ACCEPTED") return <ShieldCheck class={`${cls} text-primary`} />;
  if (props.claim.status === "CONTRADICTED") return <AlertCircle class={`${cls} text-accent`} />;
  return <Clock class={`${cls} text-muted-foreground`} />;
}
