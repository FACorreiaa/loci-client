import { createMemo, createSignal, For, Show } from "solid-js";
import { Meta, Title } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import { Users } from "lucide-solid";
import {
  type VerificationTask,
  useContributorProfile,
  usePendingPlaces,
  useVerificationTasks,
} from "~/lib/api/place-intelligence";
import type { POI } from "~/lib/api/types";
import { clampPage, pageFromParam, pageOf, pageSlice } from "~/lib/contribute/paginate";
import { resolveTask } from "~/lib/contribute/task-from-place";
import { useAuth } from "~/contexts/AuthContext";
import {
  AddPlaceForm,
  ClaimForm,
  MissingPlaceCard,
  PendingPlaceCard,
  TaskCard,
  TaskPager,
} from "~/components/contribute";
import { ErrorView } from "~/components/ErrorView";
import RegisterBanner from "~/components/ui/RegisterBanner";
import SectionHeader from "~/components/ui/SectionHeader";

export default function ContributePage() {
  const { isAuthenticated } = useAuth();
  // Every one of these RPCs is authenticated, so firing them signed out buys
  // nothing but a guaranteed 401 and a skeleton that never resolves.
  const tasks = useVerificationTasks({ enabled: () => isAuthenticated() });
  const profile = useContributorProfile({ enabled: () => isAuthenticated() });
  const pendingPlaces = usePendingPlaces({ enabled: () => isAuthenticated() });
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = createSignal<VerificationTask>();
  let listAnchor: HTMLElement | undefined;

  const allTasks = createMemo(() => tasks.data ?? []);
  const currentPage = createMemo(() =>
    clampPage(pageFromParam(searchParams.page), allTasks().length),
  );
  const visibleTasks = createMemo(() => pageSlice(allTasks(), currentPage()));

  const prefersReducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const goToPage = (next: number) => {
    const page = clampPage(next, allTasks().length);
    setSearchParams({ page: page <= 1 ? undefined : String(page) }, { replace: true });
    listAnchor?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
    });
  };

  const revealReport = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    document.getElementById("contribute-report")?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  const selectTask = (task: VerificationTask) => {
    setSelected(task);
    const index = allTasks().findIndex((item) => item.poiId === task.poiId);
    if (index >= 0) {
      const page = pageOf(index);
      if (page !== currentPage()) {
        setSearchParams({ page: page <= 1 ? undefined : String(page) }, { replace: true });
      }
    }
    revealReport();
  };

  const pickMissing = (poi: POI) => {
    selectTask(resolveTask({ id: poi.id, name: poi.name }, allTasks()));
  };

  return (
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Title>Contribute · Loci</Title>
      <Meta
        name="description"
        content="Confirm what algorithms miss about a place: hours, access, noise, crowds and the feel of it."
      />

      <section class="loci-hero">
        <div class="loci-hero__content grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p class="font-coord text-[10px] uppercase tracking-[0.2em] text-primary-foreground/65">
              Local scout network
            </p>
            <h1 class="mt-3 max-w-2xl text-3xl text-primary-foreground sm:text-4xl">
              Make the field guide more true.
            </h1>
            <p class="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/72">
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
          <div class="mt-6 grid gap-6">
            <MissingPlaceCard locked onSelect={() => undefined} />
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
        <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)] lg:items-start">
          <div class="flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-24">
            <MissingPlaceCard
              compact={Boolean(selected())}
              activePoiId={selected()?.poiId}
              onSelect={pickMissing}
            />
            <Show when={selected()}>
              {(task) => (
                <aside id="contribute-report" class="loci-card scroll-mt-28 p-6">
                  <ClaimForm task={task()} />
                </aside>
              )}
            </Show>
            <AddPlaceForm />
          </div>

          <section class="lg:col-start-1 lg:row-start-1" ref={(el) => (listAnchor = el)}>
            <SectionHeader
              kicker="Knowledge gaps near you"
              title="Places that need a fresh look"
              action={
                <span class="hidden text-xs text-muted-foreground sm:inline">
                  Two matching reports verify a fact
                </span>
              }
            />

            <Show when={(pendingPlaces.data?.length ?? 0) > 0}>
              <div class="mb-6 grid gap-3">
                <For each={pendingPlaces.data}>{(place) => <PendingPlaceCard place={place} />}</For>
              </div>
            </Show>

            <Show when={tasks.isError}>
              <ErrorView error={tasks.error} onRetry={() => tasks.refetch()} class="my-6" />
            </Show>

            <Show when={tasks.isLoading}>
              <div class="grid gap-3">
                <div class="h-20 animate-pulse rounded-xl bg-muted" />
                <div class="h-20 animate-pulse rounded-xl bg-muted" />
                <div class="h-20 animate-pulse rounded-xl bg-muted" />
              </div>
            </Show>

            <Show when={tasks.isSuccess && allTasks().length === 0}>
              <div class="loci-card p-8 text-center">
                <h3 class="text-lg">Nothing queued right now</h3>
                <p class="mt-2 text-sm text-muted-foreground">
                  We ask about places you have been looking at. Search for a place you know, or
                  explore a city and check back.
                </p>
                <A
                  href="/discover"
                  class="mt-4 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline"
                >
                  Discover places
                </A>
              </div>
            </Show>

            <div class="grid gap-2">
              <For each={visibleTasks()}>
                {(task) => (
                  <TaskCard
                    task={task}
                    selected={selected()?.poiId === task.poiId}
                    onSelect={selectTask}
                  />
                )}
              </For>
            </div>

            <TaskPager page={currentPage()} total={allTasks().length} onPageChange={goToPage} />
          </section>
        </div>
      </Show>
    </main>
  );
}
