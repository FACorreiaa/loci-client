import { Show } from "solid-js";
import { ShieldCheck, Sparkles } from "lucide-solid";

/**
 * Says whether a recommendation came from Loci's own data or from the model.
 *
 * Three states, and the third matters as much as the other two:
 *
 *   true       cited from a place Loci retrieved — it exists in our database.
 *   false      the model suggested it and Loci could not match it to a stored
 *              place. It may well be real; we simply did not verify it.
 *   undefined  the response predates grounding, so nothing was checked either
 *              way. Renders nothing — claiming "unverified" would be a
 *              statement we did not earn.
 */
export function GroundedBadge(props: { grounded?: boolean; class?: string }) {
  return (
    <Show when={props.grounded !== undefined}>
      <Show
        when={props.grounded}
        fallback={
          <span
            class={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground ${props.class ?? ""}`}
            title="Suggested by AI. Loci could not match this to a place in its database, so the details are unverified."
          >
            <Sparkles class="w-3 h-3" aria-hidden="true" />
            AI suggestion
          </span>
        }
      >
        <span
          class={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary ${props.class ?? ""}`}
          title="This place is in Loci's database — the recommendation points at a real record."
        >
          <ShieldCheck class="w-3 h-3" aria-hidden="true" />
          Verified place
        </span>
      </Show>
    </Show>
  );
}
