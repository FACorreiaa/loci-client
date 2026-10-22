import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import { ProtectedRoute } from "~/contexts/AuthContext";
import AchievementCard from "~/components/achievements/AchievementCard";
import RevealDialog from "~/components/achievements/RevealDialog";
import {
  isEarned,
  useAchievements,
  useMarkAchievementsSeen,
  type Achievement,
} from "~/lib/api/achievements";

const FILTERS = ["all", "earned", "next"] as const;
type Filter = (typeof FILTERS)[number];

const KIND_TITLES = { track: "Tracks", moment: "Moments", secret: "Secrets" } as const;

/** Closest to its next rung first: what to aim for. */
const byCloseness = (a: Achievement, b: Achievement) =>
  b.progress / (b.nextTarget || 1) - a.progress / (a.nextTarget || 1);

function AchievementsPage() {
  // ?user=<id>&name=<display name> shows someone else's (the server checks
  // they may be seen); without it, the caller's own.
  const [params] = useSearchParams<{ user?: string; name?: string }>();
  const userId = () => params.user ?? "";
  const own = () => !userId();
  const listQuery = useAchievements(userId);
  const list = () => (listQuery.isSuccess ? listQuery.data : undefined);
  const [filter, setFilter] = createSignal<Filter>("all");
  const markSeen = useMarkAchievementsSeen();

  // The "New" marks show once: a few seconds after the page shows them they
  // are cleared. The reveal dialog clears the backfilled ones itself.
  let seenTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => {
    const l = list();
    const fresh = l?.achievements.filter((a) => a.isNew && !a.hidden) ?? [];
    if (!own() || !fresh.length || l?.unseenBackfill || seenTimer) return;
    seenTimer = setTimeout(() => markSeen.mutate(fresh.map((a) => a.id)), 4000);
  });
  onCleanup(() => clearTimeout(seenTimer));

  const shown = createMemo(() => {
    const all = list()?.achievements ?? [];
    switch (filter()) {
      case "earned":
        return all.filter(isEarned);
      case "next":
        return all.filter((a) => !a.hidden && a.nextTarget > 0).sort(byCloseness);
      default:
        return all;
    }
  });
  const groups = createMemo(() =>
    (["track", "moment", "secret"] as const)
      .map((kind) => ({ kind, items: shown().filter((a) => a.kind === kind) }))
      .filter((g) => g.items.length),
  );

  return (
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Title>Achievements · Loci</Title>
      <Show when={own()}>
        <RevealDialog list={list()} />
      </Show>
      <header class="mb-6">
        <p class="font-coord mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <A href={own() ? "/field" : "/friends"} class="hover:underline">
            {own() ? "Field notebook" : "People"}
          </A>
        </p>
        <h1 class="text-3xl">
          {own() ? "Achievements" : `${params.name ?? "Their"} achievements`}
        </h1>
        <Show when={list()}>
          {(l) => (
            <p class="mt-2 text-muted-foreground">
              {l().earned} of {l().total} earned. Everything you do in Loci counts: cities, walked
              stops, notes, photos, reviews.
            </p>
          )}
        </Show>
      </header>

      <Show when={listQuery.isError}>
        <p class="loci-card p-6 text-center text-sm text-muted-foreground">
          These achievements are private.
        </p>
      </Show>

      <div class="mb-6 flex gap-2" role="group" aria-label="Show">
        <For each={FILTERS}>
          {(f) => (
            <button
              type="button"
              class="rounded-full border px-3 py-1 text-sm"
              classList={{
                "border-primary bg-primary/10 text-primary": filter() === f,
                "border-border text-muted-foreground": filter() !== f,
              }}
              aria-pressed={filter() === f}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "earned" ? "Earned" : "Up next"}
            </button>
          )}
        </For>
      </div>

      <Show when={!listQuery.isLoading} fallback={<p class="text-muted-foreground">Loading…</p>}>
        <Show
          when={filter() !== "next"}
          fallback={
            <ul class="space-y-3">
              <For each={shown()}>{(a) => <AchievementCard achievement={a} />}</For>
            </ul>
          }
        >
          <For each={groups()}>
            {(g) => (
              <section class="mb-8">
                <h2 class="mb-3 text-lg font-medium">{KIND_TITLES[g.kind]}</h2>
                <ul class="grid gap-3 sm:grid-cols-2">
                  <For each={g.items}>{(a) => <AchievementCard achievement={a} />}</For>
                </ul>
              </section>
            )}
          </For>
        </Show>
      </Show>
    </main>
  );
}

export default function AchievementsRoute() {
  return (
    <ProtectedRoute>
      <AchievementsPage />
    </ProtectedRoute>
  );
}
