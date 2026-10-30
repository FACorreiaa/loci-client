import { Show } from "solid-js";
import { A } from "@solidjs/router";
import { Crown, X } from "lucide-solid";
import {
  dismissUpgradePrompt,
  upgradePromptKind,
  upgradePromptMessage,
} from "~/lib/upgrade-prompt";
import { FREE_QUOTA_MESSAGE, FAIR_USE_MESSAGE } from "~/lib/quota-error";

const TITLE: Record<string, string> = {
  free_quota: "Daily free limit reached",
  fair_use: "Taking a short break",
  entitlement: "Unlock with Pro",
};

function bodyText(): string {
  const custom = upgradePromptMessage();
  if (custom) return custom;
  switch (upgradePromptKind()) {
    case "free_quota":
      return FREE_QUOTA_MESSAGE;
    case "fair_use":
      return FAIR_USE_MESSAGE;
    case "entitlement":
      return "This feature is included with Loci Pro.";
    default:
      return "";
  }
}

/** Global upgrade / quota modal — mount once near the app root. */
export default function UpgradePrompt() {
  return (
    <Show when={upgradePromptKind()}>
      {(kind) => (
        <div
          class="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-prompt-title"
          onClick={() => dismissUpgradePrompt()}
        >
          <div
            class="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="mb-3 flex items-start justify-between gap-3">
              <div class="flex items-center gap-2">
                <Show when={kind() !== "fair_use"}>
                  <Crown class="h-5 w-5 text-lantern" />
                </Show>
                <h2 id="upgrade-prompt-title" class="text-lg font-semibold text-foreground">
                  {TITLE[kind()] ?? "Upgrade"}
                </h2>
              </div>
              <button
                type="button"
                class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
                onClick={() => dismissUpgradePrompt()}
              >
                <X class="h-4 w-4" />
              </button>
            </div>
            <p class="mb-5 text-sm leading-relaxed text-muted-foreground">{bodyText()}</p>
            <div class="flex flex-wrap gap-2">
              <Show when={kind() !== "fair_use"}>
                <A
                  href="/pricing"
                  class="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                  onClick={() => dismissUpgradePrompt()}
                >
                  View Pro plans
                </A>
              </Show>
              <button
                type="button"
                class="inline-flex flex-1 items-center justify-center rounded-md border px-4 py-2 text-sm hover:bg-accent"
                onClick={() => dismissUpgradePrompt()}
              >
                {kind() === "fair_use" ? "Got it" : "Not now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
