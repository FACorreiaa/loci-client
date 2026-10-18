import { For, Match, Show, Switch } from "solid-js";
import { Check, Circle, Flame, Lock, Award } from "lucide-solid";
import { usePointsHistory, useProgress } from "~/lib/api/gamification";
import { useAuthGate } from "~/lib/auth/useAuthGate";

/** Your level, streak, today's checklist, badges and where points came from. */
export default function ProgressPanel() {
  const gate = useAuthGate();
  const progressQuery = useProgress(() => gate());
  const historyQuery = usePointsHistory(() => gate());
  const progress = () => (progressQuery.isSuccess ? progressQuery.data : undefined);
  const history = () => (historyQuery.isSuccess ? historyQuery.data : undefined) ?? [];

  return (
    <Switch>
      <Match when={progressQuery.isError}>
        <p class="py-6 text-sm text-muted-foreground">
          Could not load your progress. Try again in a moment.
        </p>
      </Match>
      <Match when={!progress()}>
        <p class="py-6 text-sm text-muted-foreground">Loading…</p>
      </Match>
      <Match when={progress()}>
        {(p) => (
          <div class="space-y-8">
            <section class="rounded-xl border border-border p-5">
              <div class="flex items-baseline justify-between">
                <h2 class="text-2xl">Level {p().level}</h2>
                <span
                  class="inline-flex items-center gap-1 font-medium"
                  classList={{ "text-accent": p().currentStreak > 0 }}
                >
                  <Flame class="h-4 w-4" aria-hidden="true" />
                  {p().currentStreak === 1 ? "1 day" : `${p().currentStreak} days`}
                </span>
              </div>
              <div
                class="mt-3 h-2 overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(p().levelFraction * 100)}
                aria-label={`Progress to level ${p().level + 1}`}
              >
                <div
                  class="h-full rounded-full bg-accent"
                  style={{ width: `${p().levelFraction * 100}%` }}
                />
              </div>
              <p class="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{p().totalPoints.toLocaleString()} points</span>
                <span>
                  {p().pointsToNextLevel.toLocaleString()} to level {p().level + 1}
                </span>
              </p>
            </section>

            <section>
              <h2 class="mb-3 text-lg">Today</h2>
              <ul class="space-y-2 text-sm">
                <For
                  each={[
                    { done: p().today.checkedIn, label: "Opened Loci", pts: "+5" },
                    { done: p().today.searched, label: "Searched a trip", pts: "+5" },
                    {
                      done: p().today.placesVisited > 0,
                      label:
                        p().today.placesVisited > 0
                          ? `Visited ${p().today.placesVisited} place${p().today.placesVisited === 1 ? "" : "s"}`
                          : "Visit a place with the app (Near me)",
                      pts: "+10 each",
                    },
                  ]}
                >
                  {(row) => (
                    <li class="flex items-center gap-2">
                      <Show
                        when={row.done}
                        fallback={
                          <Circle class="h-4 w-4 text-muted-foreground" aria-label="Not yet" />
                        }
                      >
                        <Check class="h-4 w-4 text-primary" aria-label="Done" />
                      </Show>
                      <span class="flex-1">{row.label}</span>
                      <span class="text-xs text-muted-foreground">{row.pts}</span>
                    </li>
                  )}
                </For>
              </ul>
            </section>

            <section>
              <h2 class="mb-3 text-lg">Badges</h2>
              <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <For each={p().badges}>
                  {(b) => (
                    <li
                      class="rounded-xl border border-border p-3 text-center"
                      classList={{ "bg-accent/10": !!b.awardedAt, "opacity-70": !b.awardedAt }}
                    >
                      <Show
                        when={b.awardedAt}
                        fallback={
                          <Lock class="mx-auto h-6 w-6 text-muted-foreground" aria-label="Locked" />
                        }
                      >
                        <Award class="mx-auto h-6 w-6 text-accent" aria-label="Earned" />
                      </Show>
                      <p class="mt-1 text-sm font-medium">{b.title}</p>
                      <p class="text-xs text-muted-foreground">{b.description}</p>
                    </li>
                  )}
                </For>
              </ul>
            </section>

            <section>
              <h2 class="mb-3 text-lg">Points</h2>
              <Show
                when={history().length}
                fallback={
                  <p class="text-sm text-muted-foreground">
                    Check in, search, and walk your trips to earn points.
                  </p>
                }
              >
                <ul class="divide-y divide-border text-sm">
                  <For each={history()}>
                    {(e) => (
                      <li class="flex items-center justify-between py-2">
                        <span>
                          {e.label}
                          <span class="block text-xs text-muted-foreground">
                            {e.createdAt ? new Date(e.createdAt).toLocaleDateString() : ""}
                          </span>
                        </span>
                        <span class="font-medium tabular-nums text-primary">+{e.points}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </section>
          </div>
        )}
      </Match>
    </Switch>
  );
}
