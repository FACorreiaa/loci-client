import { Show, createMemo } from "solid-js";
import { A } from "@solidjs/router";
import { useEntitlements } from "~/lib/api/entitlements";
import { isProPlan } from "~/lib/subscription";

/**
 * Shows free-tier list/place usage from EntitlementService.
 * Saves = list items + favorites (server-authoritative).
 */
export default function EntitlementsBadge() {
  const entitlements = useEntitlements();

  const data = createMemo(() => entitlements.data);
  const isPro = () => isProPlan(data()?.plan);

  const listCount = () => data()?.listsUsed ?? 0;
  const listLimit = () => data()?.listsLimit ?? 5;
  const placeCount = () => data()?.placesSaved ?? 0;
  const placeLimit = () => data()?.placesLimit ?? 50;

  const nearListLimit = () => {
    const lim = listLimit();
    return !isPro() && lim > 0 && listCount() >= lim - 1;
  };
  const nearPlaceLimit = () => {
    const lim = placeLimit();
    return !isPro() && lim > 0 && placeCount() >= lim - 5;
  };

  return (
    <Show when={data() && !isPro() && (listCount() > 0 || placeCount() > 0)}>
      <A
        href="/pricing"
        class={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:border-primary/40 ${
          nearListLimit() || nearPlaceLimit()
            ? "border-lantern/50 bg-lantern/10 text-lantern"
            : "border-border bg-muted/40 text-muted-foreground"
        }`}
        title="Free plan usage — upgrade for unlimited saves"
      >
        <span>
          Lists {listCount()}/{listLimit()}
        </span>
        <span class="opacity-40">·</span>
        <span>
          Saves {placeCount()}/{placeLimit()}
        </span>
      </A>
    </Show>
  );
}
