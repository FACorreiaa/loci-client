import { For, Match, Show, Switch, type JSX } from "solid-js";
import { Title } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import { ProtectedRoute } from "~/contexts/AuthContext";
import SectionHeader from "~/components/ui/SectionHeader";
import UserAvatar from "~/components/social/UserAvatar";
import { cn } from "~/cn";
import {
  fieldLine,
  useFieldBoard,
  useFieldLedger,
  useFieldProfile,
  type BoardMetric,
  type BoardRow,
  type BoardScope,
} from "~/lib/api/gamification";
import { useAuthGate } from "~/lib/auth/useAuthGate";

const SCOPES: { id: BoardScope; label: string }[] = [
  { id: "city", label: "This week in the city" },
  { id: "friends", label: "Friends" },
  { id: "personal", label: "Just me" },
];

const METRICS: { id: BoardMetric; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "kept", label: "Places kept" },
  { id: "days", label: "Days finished" },
];

const unit = (metric: BoardMetric, n: number) =>
  metric === "kept"
    ? n === 1
      ? "1 place"
      : `${n} places`
    : metric === "days"
      ? n === 1
        ? "1 day"
        : `${n} days`
      : `${n}`;

/** What counts, in the order people meet it. Kept in step with the server's Rules. */
const LEDGER_RULES: [string, string][] = [
  ["Save a place", "2"],
  ["Still saved a week later", "5"],
  ["Mark a stop walked", "8"],
  ["Finish a day (every stop walked or skipped)", "15"],
  ["Finish a trip", "25"],
  ["First place in a new neighborhood", "10"],
  ["First place in a new city", "20"],
  ["A note in your own words on a saved place", "6"],
];

function Quiet(props: { children: JSX.Element }) {
  return <p class="py-8 text-sm text-muted-foreground">{props.children}</p>;
}

function Row(props: { row: BoardRow; metric: BoardMetric }) {
  return (
    <li
      class={cn(
        "grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5",
        props.row.isMe && "bg-accent/10",
      )}
    >
      <span class="font-serif text-lg tabular-nums text-muted-foreground">
        {props.row.position}
      </span>
      <span class="flex min-w-0 items-center gap-3">
        <Show when={props.row.user}>{(u) => <UserAvatar user={u()} size="sm" />}</Show>
        <span class="min-w-0">
          <span class="block truncate font-medium">
            {props.row.isMe ? "You" : props.row.displayName}
          </span>
          <span class="font-coord block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {props.row.rank}
          </span>
        </span>
      </span>
      <span class="tabular-nums text-sm">{unit(props.metric, props.row.value)}</span>
    </li>
  );
}

function FieldPage() {
  const [params, setParams] = useSearchParams<{ scope?: string; metric?: string; city?: string }>();
  const gate = useAuthGate();
  const scope = (): BoardScope =>
    SCOPES.some((s) => s.id === params.scope) ? (params.scope as BoardScope) : "city";
  const metric = (): BoardMetric =>
    METRICS.some((m) => m.id === params.metric) ? (params.metric as BoardMetric) : "overall";

  const profileQuery = useFieldProfile(() => gate());
  const boardQuery = useFieldBoard(
    scope,
    metric,
    () => params.city ?? "",
    () => gate(),
  );
  const ledgerQuery = useFieldLedger(() => gate());

  // Read through isSuccess: .data on its own suspends to the app-wide boundary.
  const profile = () => (profileQuery.isSuccess ? profileQuery.data : undefined);
  const board = () => (boardQuery.isSuccess ? boardQuery.data : undefined);
  const ledger = () => (ledgerQuery.isSuccess ? ledgerQuery.data : undefined);

  const cityName = () => board()?.cityName || "this city";
  const showGap = () => {
    const b = board();
    const last = b?.top.at(-1)?.position ?? 0;
    const next = b?.above?.position ?? b?.me?.position ?? 0;
    return next > last + 1;
  };

  return (
    <main class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Title>Field · Loci</Title>

      <header class="mb-8">
        <p class="font-coord mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Field notebook
        </p>
        <h1 class="text-3xl">Your field score</h1>
        <Show
          when={profile()}
          fallback={<p class="mt-2 text-muted-foreground">Reading your notebook…</p>}
        >
          {(p) => (
            <p class="mt-2 font-display text-xl text-foreground">
              {p().week > 0 || p().lifetime > 0 ? fieldLine(p()) : "Nothing logged yet"}
            </p>
          )}
        </Show>
        <p class="mt-2 text-sm text-muted-foreground">
          Places you keep, stops you walk and days you finish. Opening the app and asking for ideas
          never count.
        </p>
      </header>

      <nav class="mb-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-border" aria-label="Boards">
        <For
          each={SCOPES.filter(
            (s) => s.id !== "friends" || board()?.friendsAvailable || scope() === "friends",
          )}
        >
          {(s) => (
            <button
              type="button"
              class={cn(
                "-mb-px border-b-2 pb-2 text-sm transition-colors",
                scope() === s.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              aria-current={scope() === s.id ? "page" : undefined}
              onClick={() => setParams({ scope: s.id === "city" ? undefined : s.id })}
            >
              {s.label}
            </button>
          )}
        </For>
      </nav>

      <section class="mb-10">
        <Switch>
          <Match when={boardQuery.isError}>
            <Quiet>The board did not load. Try again in a moment.</Quiet>
          </Match>
          <Match when={!board()}>
            <Quiet>Opening the board…</Quiet>
          </Match>

          <Match when={scope() === "personal" && board()?.personal}>
            {(p) => (
              <dl class="grid gap-4 py-2 sm:grid-cols-3">
                <div>
                  <dt class="kicker mb-1">This week</dt>
                  <dd class="font-display text-2xl tabular-nums">{p().thisWeek}</dd>
                  <dd class="text-sm text-muted-foreground">Last week {p().lastWeek}</dd>
                </div>
                <div>
                  <dt class="kicker mb-1">Places kept</dt>
                  <dd class="font-display text-2xl tabular-nums">{p().placesKept}</dd>
                  <dd class="text-sm text-muted-foreground">Last week {p().placesKeptLastWeek}</dd>
                </div>
                <div>
                  <dt class="kicker mb-1">Days finished</dt>
                  <dd class="font-display text-2xl tabular-nums">{p().daysFinished}</dd>
                  <dd class="text-sm text-muted-foreground">
                    Last week {p().daysFinishedLastWeek}
                  </dd>
                </div>
              </dl>
            )}
          </Match>

          <Match when={scope() === "friends" && !board()?.friendsAvailable}>
            <Quiet>
              Your friends board opens once you have a friend on Loci.{" "}
              <A href="/friends?tab=add" class="underline">
                Invite someone you travel with
              </A>
              .
            </Quiet>
          </Match>

          <Match when={scope() === "city" && !board()?.cityId}>
            <Quiet>
              No city yet. Plan a trip or look up a city, and its board opens here.{" "}
              <A href="/trips" class="underline">
                Your trips
              </A>
            </Quiet>
          </Match>

          <Match when={board()}>
            {(b) => (
              <>
                <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p class="kicker mb-1">
                      {scope() === "friends" ? "You and your friends" : cityName()} · this week
                    </p>
                    <h2 class="editorial-title text-xl">
                      {scope() === "friends" ? "Friends, this week" : `${cityName()}, this week`}
                    </h2>
                  </div>
                  <div class="flex flex-wrap gap-2" role="group" aria-label="Ranked by">
                    <For each={METRICS}>
                      {(m) => (
                        <button
                          type="button"
                          class={cn(
                            "loci-chip text-xs",
                            metric() === m.id
                              ? "bg-primary text-primary-foreground"
                              : "loci-chip--surface",
                          )}
                          aria-pressed={metric() === m.id}
                          onClick={() =>
                            setParams({ metric: m.id === "overall" ? undefined : m.id })
                          }
                        >
                          {m.label}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <Show
                  when={b().top.length}
                  fallback={
                    <div class="loci-card rounded-2xl p-6">
                      <h3 class="font-display text-lg">
                        Nothing on the board in {scope() === "friends" ? "your circle" : cityName()}{" "}
                        this week
                      </h3>
                      <p class="mt-1 text-sm text-muted-foreground">
                        Mark a stop walked on one of your trips, or save a place you mean to go to.
                        The first line here could be yours.
                      </p>
                    </div>
                  }
                >
                  <ol class="flex flex-col gap-0.5">
                    <For each={b().top}>{(r) => <Row row={r} metric={metric()} />}</For>
                    <Show when={showGap()}>
                      <li class="px-3 py-1 text-muted-foreground" aria-hidden="true">
                        ⋯
                      </li>
                    </Show>
                    <Show when={b().above}>{(r) => <Row row={r()} metric={metric()} />}</Show>
                    <Show when={b().me}>{(r) => <Row row={r()} metric={metric()} />}</Show>
                  </ol>
                  <Show when={b().tooFew}>
                    <p class="mt-3 text-xs text-muted-foreground">
                      {b().scored === 1 ? "One person" : `${b().scored} people`} on this board so
                      far. It fills as people walk {scope() === "friends" ? "" : cityName()}.
                    </p>
                  </Show>
                </Show>

                <Show when={scope() === "city" && b().meHidden}>
                  <p class="mt-3 text-xs text-muted-foreground">
                    You are hidden from other people on city boards.{" "}
                    <A href="/settings" class="underline">
                      Change it in Settings
                    </A>
                    .
                  </p>
                </Show>
              </>
            )}
          </Match>
        </Switch>
      </section>

      <Show when={profile()?.cities.length}>
        <section class="mb-10">
          <SectionHeader kicker="Ranks" title="Where you stand" size="sm" />
          <ul class="divide-y divide-border">
            <For each={profile()!.cities}>
              {(c) => (
                <li class="flex items-baseline justify-between gap-3 py-2.5">
                  <span>
                    <span class="font-medium">{c.rank}</span>
                    <span class="text-muted-foreground"> in {c.cityName}</span>
                  </span>
                  <span class="text-sm tabular-nums text-muted-foreground">
                    {c.score}
                    <Show when={c.nextThreshold > 0}>
                      {" "}
                      · {c.nextThreshold - c.score} to the next rank
                    </Show>
                  </span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      <section class="mb-10">
        <SectionHeader kicker="Ledger" title="Lately" size="sm" />
        <Show
          when={ledger()?.length}
          fallback={<Quiet>Nothing logged yet. Your first saved place starts the ledger.</Quiet>}
        >
          <ul class="divide-y divide-border">
            <For each={ledger()}>
              {(e) => (
                <li class="flex items-baseline justify-between gap-3 py-2.5">
                  <span class="min-w-0">
                    <span class="block truncate">{e.label}</span>
                    <Show when={e.cityName}>
                      <span class="text-xs text-muted-foreground">{e.cityName}</span>
                    </Show>
                  </span>
                  <span class="shrink-0 text-sm tabular-nums text-muted-foreground">
                    +{e.points}
                  </span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>

      <details class="text-sm text-muted-foreground">
        <summary class="cursor-pointer text-foreground">How the field score counts</summary>
        <ul class="mt-3 divide-y divide-border">
          <For each={LEDGER_RULES}>
            {([what, pts]) => (
              <li class="flex justify-between gap-3 py-2">
                <span>{what}</span>
                <span class="tabular-nums">{pts}</span>
              </li>
            )}
          </For>
        </ul>
        <p class="mt-3">
          Saves count up to ten a day, and once per place: saving it again later does not count.
          Weeks start on Monday where you are. Your rank never goes down.
        </p>
      </details>
    </main>
  );
}

export default function Field() {
  return (
    <ProtectedRoute>
      <FieldPage />
    </ProtectedRoute>
  );
}
