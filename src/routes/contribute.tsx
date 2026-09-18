import { createSignal, For, Show } from "solid-js";
import { Meta, Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { Users } from "lucide-solid";
import {
  type VerificationTask,
  useContributorProfile,
  useVerificationTasks,
} from "~/lib/api/place-intelligence";
import { useAuth } from "~/contexts/AuthContext";
import { ClaimForm, TaskCard } from "~/components/contribute";
import { ErrorView } from "~/components/ErrorView";
import RegisterBanner from "~/components/ui/RegisterBanner";

export default function ContributePage() {
  const { isAuthenticated } = useAuth();
  // Every one of these RPCs is authenticated, so firing them signed out buys
  // nothing but a guaranteed 401 and a skeleton that never resolves.
  const tasks = useVerificationTasks({ enabled: () => isAuthenticated() });
  const profile = useContributorProfile({ enabled: () => isAuthenticated() });
  const [selected, setSelected] = createSignal<VerificationTask>();

  return (
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Title>Contribute · Loci</Title>
      <Meta
        name="description"
        content="Confirm what algorithms miss about a place: hours, access, noise, crowds and the feel of it."
      />

      <section class="loci-hero">
        <div class="loci-hero__content grid gap-8 p-7 sm:p-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p class="font-coord text-[10px] uppercase tracking-[0.2em] text-primary-foreground/65">
              Local scout network
            </p>
            <h1 class="mt-3 max-w-2xl text-4xl text-primary-foreground sm:text-5xl">
              Make the field guide more true.
            </h1>
            <p class="mt-4 max-w-xl text-sm leading-6 text-primary-foreground/72">
              Confirm the useful details algorithms miss: current hours, accessibility, noise,
              crowds, and the feel of a place.
            </p>
          </div>
          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="loci-hero__stat">
              <b class="block text-xl">{profile.data?.reputation || 0}</b>
              <span class="text-[10px] text-primary-foreground/60">Reputation</span>
            </div>
            <div class="loci-hero__stat">
              <b class="block text-xl">{profile.data?.submittedClaims || 0}</b>
              <span class="text-[10px] text-primary-foreground/60">Reports</span>
            </div>
            <div class="loci-hero__stat">
              <b class="block text-xl">{profile.data?.acceptedClaims || 0}</b>
              <span class="text-[10px] text-primary-foreground/60">Verified</span>
            </div>
          </div>
        </div>
      </section>

      <Show
        when={isAuthenticated()}
        fallback={
          <div class="mt-8">
            <RegisterBanner
              title="Sign in to scout"
              description="Field reports are tied to your account, so your reputation follows you and two scouts can be told apart."
              badge="Scouts only"
              ctaLabel="Sign in"
              icon={Users}
            />
          </div>
        }
      >
        <div class="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <section>
            <div class="mb-4 flex items-end justify-between gap-4">
              <div>
                <p class="font-coord text-[10px] uppercase tracking-[0.18em] text-accent">
                  Knowledge gaps near you
                </p>
                <h2 class="mt-1 text-2xl">Places that need a fresh look</h2>
              </div>
              <span class="text-xs text-muted-foreground">Two matching reports verify a fact</span>
            </div>

            <Show when={tasks.isError}>
              <ErrorView error={tasks.error} onRetry={() => tasks.refetch()} class="my-6" />
            </Show>

            <Show when={tasks.isLoading}>
              <div class="grid gap-3">
                <div class="h-32 animate-pulse rounded-xl bg-muted" />
                <div class="h-32 animate-pulse rounded-xl bg-muted" />
              </div>
            </Show>

            {/* A successful but empty response used to render a bare heading,
                because the old <For> fallback only covered `undefined`. */}
            <Show when={tasks.isSuccess && (tasks.data?.length ?? 0) === 0}>
              <div class="rounded-xl border border-border bg-card p-8 text-center">
                <h3 class="text-lg">Nothing to verify right now</h3>
                <p class="mt-2 text-sm text-muted-foreground">
                  We ask about places you have been looking at. Explore a city and check back.
                </p>
                <A
                  href="/discover"
                  class="mt-4 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline"
                >
                  Discover places
                </A>
              </div>
            </Show>

            <div class="grid gap-3">
              <For each={tasks.data ?? []}>
                {(task) => (
                  <TaskCard
                    task={task}
                    selected={selected()?.poiId === task.poiId}
                    onSelect={setSelected}
                  />
                )}
              </For>
            </div>
          </section>

          <aside class="h-fit rounded-xl border border-border bg-card p-6 lg:sticky lg:top-24">
            <Show
              when={selected()}
              fallback={
                <div class="py-10 text-center">
                  <Users class="mx-auto h-7 w-7 text-muted-foreground" />
                  <h2 class="mt-4 text-xl">Choose a place</h2>
                  <p class="mt-2 text-sm text-muted-foreground">
                    Share only what you observed yourself and recently.
                  </p>
                </div>
              }
            >
              {(task) => <ClaimForm task={task()} />}
            </Show>
          </aside>
        </div>
      </Show>
    </main>
  );
}
