import { createSignal, For, Match, Show, Switch } from "solid-js";
import { Flame, Trophy } from "lucide-solid";
import UserAvatar from "~/components/social/UserAvatar";
import InviteCard from "~/components/social/InviteCard";
import { formatMetric, useLeaderboard, type Metric, type Period } from "~/lib/api/gamification";
import { useAuthGate } from "~/lib/auth/useAuthGate";

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All time" },
];
const METRICS: { id: Metric; label: string }[] = [
  { id: "points", label: "Points" },
  { id: "cities", label: "Cities" },
  { id: "places", label: "Places" },
];

function Segmented<T extends string>(props: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={props.label}
      class="inline-flex rounded-lg bg-secondary/60 p-1"
    >
      <For each={props.options}>
        {(o) => (
          <button
            type="button"
            role="radio"
            aria-checked={props.value === o.id}
            class="rounded-md px-3 py-1 text-sm transition-colors"
            classList={{
              "bg-background font-medium shadow-sm": props.value === o.id,
              "text-muted-foreground hover:text-foreground": props.value !== o.id,
            }}
            onClick={() => props.onChange(o.id)}
          >
            {o.label}
          </button>
        )}
      </For>
    </div>
  );
}

/** You and your friends, ranked. Friends only; nobody else is on it. */
export default function LeaderboardPanel() {
  const gate = useAuthGate();
  const [period, setPeriod] = createSignal<Period>("week");
  const [metric, setMetric] = createSignal<Metric>("points");
  const board = useLeaderboard(period, metric, () => gate());
  const entries = () => (board.isSuccess ? board.data : undefined);

  return (
    <section class="space-y-4">
      <div class="flex flex-wrap gap-3">
        <Segmented label="Period" options={PERIODS} value={period()} onChange={setPeriod} />
        <Segmented label="Ranked by" options={METRICS} value={metric()} onChange={setMetric} />
      </div>
      <Switch>
        <Match when={board.isError}>
          <p class="py-6 text-sm text-muted-foreground">
            Could not load the leaderboard. Try again in a moment.
          </p>
        </Match>
        <Match when={!entries()}>
          <p class="py-6 text-sm text-muted-foreground">Loading…</p>
        </Match>
        <Match when={entries()}>
          {(list) => (
            <>
              <ol class="divide-y divide-border rounded-xl border border-border">
                <For each={list()}>
                  {(e) => (
                    <li
                      class="flex items-center gap-3 px-4 py-3"
                      classList={{ "bg-accent/10": e.isMe }}
                    >
                      <span
                        class="w-7 text-center font-serif text-lg"
                        classList={{ "text-accent": e.rank === 1 }}
                      >
                        <Show when={e.rank === 1} fallback={e.rank}>
                          <Trophy class="mx-auto h-5 w-5" aria-label="First" />
                        </Show>
                      </span>
                      <UserAvatar user={e.user} />
                      <div class="min-w-0 flex-1">
                        <p class="truncate font-medium">{e.isMe ? "You" : e.user.displayName}</p>
                        <p class="flex items-center gap-2 text-xs text-muted-foreground">
                          Level {e.level}
                          <Show when={e.currentStreak > 0}>
                            <span class="inline-flex items-center gap-0.5 text-accent">
                              <Flame class="h-3 w-3" aria-hidden="true" />
                              {e.currentStreak}
                            </span>
                          </Show>
                        </p>
                      </div>
                      <span class="font-medium tabular-nums">
                        {formatMetric(metric(), e.value)}
                      </span>
                    </li>
                  )}
                </For>
              </ol>
              <p class="text-xs text-muted-foreground">
                Only you and your friends are ranked here. You can leave it in Settings →
                Notifications.
              </p>
              <Show when={list().length <= 1}>
                <div class="space-y-3 pt-2">
                  <h2 class="text-lg">Compete with friends</h2>
                  <p class="text-sm text-muted-foreground">
                    Send your invite link — on Instagram, X, WhatsApp or anywhere. Everyone who
                    opens it joins your leaderboard.
                  </p>
                  <InviteCard />
                </div>
              </Show>
            </>
          )}
        </Match>
      </Switch>
    </section>
  );
}
