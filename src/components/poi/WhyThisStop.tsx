import { Show } from "solid-js";
import { Sparkles, Info } from "lucide-solid";

export interface WhyThisStopProps {
  /** Short rationale text. Hidden when empty. */
  reason?: string | null;
  /** 0..1, higher = the model was less sure. Renders a confidence chip. */
  uncertaintyScore?: number;
  /** Fields that couldn't be verified (e.g. ["hours", "price"]). */
  missingData?: string[];
  class?: string;
}

const confidenceLabel = (uncertainty: number) => {
  const confidence = 1 - uncertainty;
  if (confidence >= 0.75) return { label: "High confidence", tone: "text-emerald-600" };
  if (confidence >= 0.5) return { label: "Medium confidence", tone: "text-amber-600" };
  return { label: "Low confidence", tone: "text-orange-600" };
};

/** Compact transparency block — "Why this", confidence, and missing-data notice. */
export default function WhyThisStop(props: WhyThisStopProps) {
  const text = () => props.reason?.trim() ?? "";
  const hasConfidence = () => typeof props.uncertaintyScore === "number";
  const missing = () => props.missingData ?? [];

  return (
    <Show when={text() || hasConfidence() || missing().length > 0}>
      <div class={`mt-1.5 space-y-1 ${props.class ?? ""}`}>
        <Show when={text()}>
          <p class="trust-chip" title="Why Loci suggested this">
            <Sparkles class="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
            <span class="min-w-0">
              <span class="font-medium text-primary">Why this: </span>
              {text()}
            </span>
          </p>
        </Show>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <Show when={hasConfidence()}>
            {(_) => {
              const c = confidenceLabel(props.uncertaintyScore!);
              return (
                <span class={`inline-flex items-center gap-1 font-medium ${c.tone}`}>
                  <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                  {c.label}
                </span>
              );
            }}
          </Show>

          <Show when={missing().length > 0}>
            <span
              class="inline-flex items-center gap-1 text-muted-foreground"
              title="Loci couldn't verify these details"
            >
              <Info class="h-3 w-3" aria-hidden="true" />
              Unverified: {missing().join(", ")}
            </span>
          </Show>
        </div>
      </div>
    </Show>
  );
}
