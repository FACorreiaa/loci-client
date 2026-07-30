import { For, Show } from "solid-js";
import { Info } from "lucide-solid";
import type { GoScore } from "@buf/loci_loci-proto.bufbuild_es/loci/localcontext/localcontext_pb.js";

interface GoScoreCardProps {
  score: GoScore;
  /** Compact mode drops the factor breakdown — for dense layouts like cards. */
  compact?: boolean;
}

/**
 * The "should I go this weekend?" verdict.
 *
 * The reasoning is not optional decoration: a bare 62 tells nobody anything, and
 * a user who disagrees with the number needs to see that it was 22/40 on weather
 * so they can overrule it. So the factors render by default, and `compact` only
 * hides them where there is genuinely no room.
 */
export function GoScoreCard(props: GoScoreCardProps) {
  const verdict = () => props.score.verdict || "maybe";

  const tone = () => {
    switch (verdict()) {
      case "go":
        return {
          ring: "border-accent/40",
          bg: "bg-accent/10",
          text: "text-accent",
          label: "Worth going",
        };
      case "skip":
        return {
          ring: "border-destructive/40",
          bg: "bg-destructive/10",
          text: "text-destructive",
          label: "Probably skip",
        };
      default:
        return {
          ring: "border-border",
          bg: "bg-muted/40",
          text: "text-foreground",
          label: "Could work",
        };
    }
  };

  return (
    <div class={`loci-card border ${tone().ring} ${tone().bg} p-4`}>
      <div class="flex items-baseline justify-between gap-3">
        <div class="min-w-0">
          <p class="font-coord text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Should I go?
          </p>
          <p class={`text-sm font-semibold ${tone().text}`}>{tone().label}</p>
        </div>
        <div class="flex items-baseline gap-1 flex-shrink-0">
          <span class={`text-2xl font-bold tabular-nums ${tone().text}`}>{props.score.score}</span>
          <span class="text-xs text-muted-foreground">/100</span>
        </div>
      </div>

      <Show when={props.score.summary}>
        <p class="mt-2 text-sm text-muted-foreground">{props.score.summary}</p>
      </Show>

      <Show when={!props.compact && props.score.factors.length > 0}>
        <ul class="mt-3 space-y-2 border-t border-border/60 pt-3">
          <For each={props.score.factors}>
            {(factor) => {
              const negative = () => factor.contribution < 0;
              // Bar width is meaningless for a penalty (no ceiling), so those
              // render as a plain signed number instead of a fake proportion.
              const pct = () =>
                factor.maxContribution > 0
                  ? Math.max(0, Math.min(100, (factor.contribution / factor.maxContribution) * 100))
                  : 0;

              return (
                <li class="text-xs">
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="font-medium text-foreground">{factor.label}</span>
                    <span
                      class="tabular-nums text-muted-foreground"
                      classList={{ "text-destructive": negative() }}
                    >
                      {negative()
                        ? factor.contribution
                        : `${factor.contribution} / ${factor.maxContribution}`}
                    </span>
                  </div>
                  <Show when={factor.maxContribution > 0}>
                    <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-border/60">
                      <div
                        class="h-full rounded-full bg-current opacity-70"
                        classList={{ "text-accent": !negative(), "text-destructive": negative() }}
                        style={{ width: `${pct()}%` }}
                      />
                    </div>
                  </Show>
                  <p class="mt-1 text-muted-foreground">{factor.detail}</p>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>

      <Show when={props.score.hasEstimatedInputs}>
        <p class="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info class="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>
            Some inputs are estimated — no live weather key is configured, so treat the forecast
            part as a guess.
          </span>
        </p>
      </Show>
    </div>
  );
}

export default GoScoreCard;
