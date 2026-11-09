import { For, Show, createMemo } from "solid-js";
import { Crown, Lock } from "lucide-solid";
import { showUpgradePrompt } from "~/lib/upgrade-prompt";

export type AdvancedFilterId =
  | "cuisine"
  | "accessible"
  | "quiet"
  | "hidden_gems"
  | "open_now"
  | "budget";

export interface AdvancedFilterOption {
  id: AdvancedFilterId;
  label: string;
  /** Appended to the discover/chat prompt when active. */
  promptHint: string;
  /**
   * Free on every plan. Access is not a premium feature: a traveller who
   * needs step-free places must never meet a paywall to ask for them.
   */
  free?: boolean;
}

export const ADVANCED_FILTERS: AdvancedFilterOption[] = [
  { id: "cuisine", label: "Cuisine", promptHint: "prefer specific cuisine types" },
  {
    id: "accessible",
    label: "Accessible",
    promptHint: "wheelchair accessible and step-free",
    free: true,
  },
  { id: "quiet", label: "Quiet", promptHint: "low noise, calm spots" },
  { id: "hidden_gems", label: "Hidden gems", promptHint: "less touristy local favorites" },
  { id: "open_now", label: "Open now", promptHint: "currently open" },
  { id: "budget", label: "Budget", promptHint: "budget-friendly options" },
];

export interface AdvancedFiltersBarProps {
  isPro: boolean;
  active: AdvancedFilterId[];
  onChange: (next: AdvancedFilterId[]) => void;
}

/** Whether a filter can be used on this plan. */
export const filterAvailable = (f: AdvancedFilterOption, isPro: boolean) => isPro || !!f.free;

/**
 * Advanced filters, mostly Pro. Free users see locked chips → upgrade prompt,
 * except for the free ones (Accessible). The parent folds promptHint into the
 * stream message.
 */
export default function AdvancedFiltersBar(props: AdvancedFiltersBarProps) {
  const activeSet = createMemo(() => new Set(props.active));

  const toggle = (f: AdvancedFilterOption) => {
    const id = f.id;
    if (!filterAvailable(f, props.isPro)) {
      showUpgradePrompt(
        "entitlement",
        "Advanced filters (cuisine, accessibility, niche tags, precise hours) are included with Pro.",
      );
      return;
    }
    const next = new Set(props.active);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    props.onChange([...next]);
  };

  return (
    <div class="mb-4">
      <div class="mb-2 flex items-center gap-2">
        <p class="text-xs font-medium uppercase tracking-wide text-foreground">Advanced filters</p>
        <Show when={!props.isPro}>
          <span class="inline-flex items-center gap-1 rounded-full border border-lantern/40 bg-lantern/10 px-2 py-0.5 text-[10px] font-medium text-lantern">
            <Crown class="h-3 w-3" />
            Pro
          </span>
        </Show>
      </div>
      <div class="flex flex-wrap gap-2">
        <For each={ADVANCED_FILTERS}>
          {(f) => {
            const on = () => activeSet().has(f.id);
            return (
              <button
                type="button"
                class={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  on()
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-primary/40"
                }`}
                onClick={() => toggle(f)}
                aria-pressed={on()}
              >
                <Show when={!filterAvailable(f, props.isPro)}>
                  <Lock class="h-3 w-3" aria-hidden="true" />
                  <span class="sr-only">Pro: </span>
                </Show>
                {f.label}
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
}

/** Build a prompt suffix from the active filters this plan can use. */
export function advancedFilterPromptSuffix(active: AdvancedFilterId[], isPro: boolean): string {
  if (!active.length) return "";
  const hints = ADVANCED_FILTERS.filter(
    (f) => active.includes(f.id) && filterAvailable(f, isPro),
  ).map((f) => f.promptHint);
  if (!hints.length) return "";
  return ` Constraints: ${hints.join("; ")}.`;
}
