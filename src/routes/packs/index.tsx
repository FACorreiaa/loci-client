import { createMemo, createSignal, For, Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import SectionHeader from "~/components/ui/SectionHeader";
import PackCard from "~/components/packs/PackCard";
import { ErrorView } from "~/components/ErrorView";
import { usePacks } from "~/lib/api/bundles";
import { PACK_THEMES, PACK_THEME_META, isPackTheme } from "~/lib/bundles/themes";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The City Packs catalog: trips somebody already planned.
 *
 * Filter state lives in the query string rather than in a signal, so a
 * filtered view is a link somebody can send, and so the page a search engine
 * crawls is the page a visitor lands on.
 */
export default function PacksPage() {
  const [params, setParams] = useSearchParams();
  const [showAllMonths, setShowAllMonths] = createSignal(false);

  const theme = () => {
    const t = params.theme;
    return typeof t === "string" && isPackTheme(t) ? t : undefined;
  };
  const month = () => {
    const m = Number(params.month);
    return Number.isInteger(m) && m >= 1 && m <= 12 ? m : undefined;
  };
  const onlyFree = () => params.free === "1";

  const packsQuery = usePacks(() => ({
    theme: theme(),
    month: month(),
    onlyFree: onlyFree(),
  }));

  const packs = createMemo(() => packsQuery.data?.packs ?? []);
  const hasFilters = () => !!theme() || !!month() || onlyFree();

  const toggle = (key: "theme" | "month" | "free", value: string) => {
    const current = params[key];
    setParams({ [key]: current === value ? undefined : value });
  };

  const currentMonth = new Date().getMonth() + 1;
  const visibleMonths = () =>
    showAllMonths()
      ? MONTHS.map((_, i) => i + 1)
      : [currentMonth, (currentMonth % 12) + 1, ((currentMonth + 1) % 12) + 1];

  return (
    <main class="mx-auto w-full max-w-6xl px-4 py-8">
      <Title>City Packs — trips already planned | Loci</Title>
      <Meta
        name="description"
        content="Ready-made city itineraries for the right time of year: day-by-day plans with real places, written and checked before they are published."
      />
      <Meta property="og:title" content="City Packs — trips already planned" />
      <Meta
        property="og:description"
        content="Ready-made city itineraries for the right time of year. Day one of every pack is free to read."
      />
      <Meta property="og:url" content="https://lociai.fyi/packs" />

      <SectionHeader
        kicker="City Packs"
        title="Trips somebody already planned"
        subtitle="Day-by-day guides for a city at the time of year it is worth going. Day one of every pack is free to read."
        size="lg"
      />

      <div class="mt-6 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-coord text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            Taste
          </span>
          <For each={PACK_THEMES}>
            {(t) => (
              <button
                type="button"
                class="loci-chip loci-chip--surface"
                aria-pressed={theme() === t}
                data-active={theme() === t}
                onClick={() => toggle("theme", t)}
              >
                <span aria-hidden="true">{PACK_THEME_META[t].emoji}</span>
                {PACK_THEME_META[t].label}
              </button>
            )}
          </For>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span class="font-coord text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            When
          </span>
          <For each={visibleMonths()}>
            {(m) => (
              <button
                type="button"
                class="loci-chip loci-chip--surface"
                aria-pressed={month() === m}
                data-active={month() === m}
                onClick={() => toggle("month", String(m))}
              >
                {MONTHS[m - 1]}
              </button>
            )}
          </For>
          <Show when={!showAllMonths()}>
            <button
              type="button"
              class="text-xs text-muted-foreground underline underline-offset-4"
              onClick={() => setShowAllMonths(true)}
            >
              all months
            </button>
          </Show>
          <button
            type="button"
            class="loci-chip loci-chip--surface"
            aria-pressed={onlyFree()}
            data-active={onlyFree()}
            onClick={() => toggle("free", "1")}
          >
            Free only
          </button>
        </div>

        <Show when={hasFilters()}>
          <button
            type="button"
            class="text-xs text-muted-foreground underline underline-offset-4"
            onClick={() => setParams({ theme: undefined, month: undefined, free: undefined })}
          >
            Clear filters
          </button>
        </Show>
      </div>

      <Show
        when={!packsQuery.isPending}
        fallback={
          <ul class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <For each={[0, 1, 2, 3, 4, 5]}>
              {() => <li class="loci-card h-40 animate-pulse" aria-hidden="true" />}
            </For>
          </ul>
        }
      >
        <Show
          when={!packsQuery.isError}
          fallback={
            <ErrorView
              class="mt-8"
              error={packsQuery.error}
              onRetry={() => void packsQuery.refetch()}
            />
          }
        >
          <Show
            when={packs().length > 0}
            fallback={
              <p class="mt-8 text-sm text-muted-foreground">
                {hasFilters()
                  ? "No packs match those filters yet."
                  : "No packs published yet. They are written and checked by hand, so they arrive a few at a time."}
              </p>
            }
          >
            <ul class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <For each={packs()}>{(pack) => <PackCard pack={pack} />}</For>
            </ul>
          </Show>
        </Show>
      </Show>
    </main>
  );
}
