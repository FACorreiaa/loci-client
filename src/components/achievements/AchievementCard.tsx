import { For, Show } from "solid-js";
import Medallion from "./Medallion";
import {
  achievementLabel,
  isEarned,
  progressShare,
  rarityLine,
  type Achievement,
} from "~/lib/api/achievements";

const TIER_LABELS = { none: "", bronze: "B", silver: "S", gold: "G", platinum: "P" } as const;

/** One achievement with its progress: the catalogue's unit of display. */
export default function AchievementCard(props: { achievement: Achievement }) {
  const a = () => props.achievement;
  const earned = () => isEarned(a());
  const title = () => (a().hidden ? "Secret" : achievementLabel(a()));
  return (
    <li class="loci-card flex gap-3 p-4">
      <Medallion icon={a().icon} kind={a().kind} tier={a().tier} earned={earned()} />
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2">
          <h3 class="truncate font-medium">{title()}</h3>
          <Show when={a().isNew}>
            <span class="rounded-full bg-accent px-1.5 text-[10px] font-bold uppercase text-accent-foreground">
              New
            </span>
          </Show>
        </div>
        <p class="text-sm text-muted-foreground">
          {a().hidden ? "Keep exploring to find out." : a().description}
        </p>
        <Show when={!a().hidden && a().nextTarget > 0}>
          <div class="mt-2 flex items-center gap-2">
            <div
              class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={a().nextTarget}
              aria-valuenow={Math.min(a().progress, a().nextTarget)}
              aria-label={`${title()} progress`}
            >
              <div
                class="h-full rounded-full bg-primary"
                style={{ width: `${Math.round(progressShare(a()) * 100)}%` }}
              />
            </div>
            <span class="font-coord text-xs tabular-nums text-muted-foreground">
              {Math.min(a().progress, a().nextTarget)}/{a().nextTarget}
            </span>
          </div>
        </Show>
        <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Show when={a().kind === "track" && a().steps.length}>
            <span class="flex gap-1" aria-label="Tiers">
              <For each={a().steps}>
                {(s) => (
                  <span
                    class="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold"
                    classList={{ "border-dashed": !s.earnedAt }}
                    style={
                      s.earnedAt
                        ? {
                            "border-color": `hsl(var(--tier-${s.tier}))`,
                            color: `hsl(var(--tier-${s.tier}))`,
                          }
                        : undefined
                    }
                    title={`${s.tier} at ${s.threshold}`}
                  >
                    {TIER_LABELS[s.tier]}
                  </span>
                )}
              </For>
            </span>
          </Show>
          <Show when={rarityLine(a().rarityPct)}>{(r) => <span>{r()}</span>}</Show>
          <Show when={a().earnedAt}>
            {(at) => <span>Earned {new Date(at()).toLocaleDateString()}</span>}
          </Show>
        </div>
      </div>
    </li>
  );
}
