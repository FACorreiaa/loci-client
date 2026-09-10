import { Show } from "solid-js";
import { Crown } from "lucide-solid";
import { useEntitlements } from "~/lib/api/entitlements";
import { isProPlan, planDisplayName } from "~/lib/subscription";

/**
 * The Pro mark, shown only to Pro accounts.
 *
 * Reads the plan through EntitlementService, which resolves it the same way
 * every server-side gate does — so a complimentary Pro (PRO_EMAILS) shows the
 * badge without a Stripe row. Free accounts render nothing: the upsell lives
 * on /pricing, not on their own name.
 */
export default function ProPlanBadge(props: { class?: string; size?: "sm" | "md" }) {
  const entitlements = useEntitlements();
  const plan = () => entitlements.data?.plan;
  const isPro = () => isProPlan(plan());
  const sizing = () =>
    props.size === "sm"
      ? "px-1.5 py-0.5 text-[9px] gap-1 [&>svg]:h-2.5 [&>svg]:w-2.5"
      : "px-2.5 py-1 text-[11px] gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5";

  return (
    <Show when={isPro()}>
      <span
        class={`inline-flex items-center rounded-full border border-accent/40 bg-accent/15 font-coord uppercase tracking-[0.12em] text-accent ${sizing()} ${props.class ?? ""}`}
        title={planDisplayName(plan())}
        aria-label={`${planDisplayName(plan())} plan`}
      >
        <Crown aria-hidden="true" />
        Pro
      </span>
    </Show>
  );
}
