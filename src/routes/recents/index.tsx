import { createMemo, createSignal, Show, type JSX } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { History, MapPin, RotateCcw, Search } from "lucide-solid";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { cn } from "~/lib/utils";
import { useActivityHistory, ACTIVITY_PAGE_SIZE } from "~/lib/api/recents";
import { useDefaultSearchProfile } from "~/lib/api/profiles";
import { bucketByDay } from "~/lib/recents/day-buckets";
import type { ActivityEntry } from "~/lib/recents/types";
import ActivityFeed from "~/components/features/Recents/ActivityFeed";
import ActivityTypeChips, {
  ACTIVITY_TYPE_OPTIONS,
} from "~/components/features/Recents/ActivityTypeChips";
import CitiesView from "~/components/features/Recents/CitiesView";

/**
 * /recents — what you did, newest first.
 *
 * This page used to be a grid of city cards, which could say where you had been
 * but not what you had done there: a chat, a discover search and an itinerary
 * request all collapsed into the same city tile, and a saved trip or a
 * favourited place did not appear at all. The feed is the answer to the actual
 * question, and the city grid is kept behind a toggle for the other one.
 */
export default function RecentsPage() {
  const [params, setParams] = useSearchParams();

  // The view lives in the URL so refresh and back/forward behave, and so a tab
  // can be linked to. A bare signal loses both.
  const view = () => (params.view === "cities" ? "cities" : "feed");

  const [typeFilter, setTypeFilter] = createSignal("all");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [pages, setPages] = createSignal(1);

  // Captured once. Passing the clock in rather than reading it inside the memo
  // keeps the bucketing a pure function of its inputs, so the groups do not
  // recompute on every tick. The cost is that the headings do not move at
  // midnight without a reload, which nobody reading a history page will notice.
  const now = new Date();

  const profile = useDefaultSearchProfile();
  const profileId = () => profile.data?.id;

  const activityQuery = useActivityHistory(pages);
  const allEntries = (): ActivityEntry[] => activityQuery.data?.entries ?? [];

  const matchesType = (entry: ActivityEntry, filterId: string) => {
    if (filterId === "all") return true;
    const option = ACTIVITY_TYPE_OPTIONS.find((o) => o.id === filterId);
    if (!option) return true;
    if (option.kind && entry.kind !== option.kind) return false;
    if (option.detail && entry.detail !== option.detail) return false;
    return true;
  };

  // Filtering happens here rather than in the request. The server supports it,
  // but its InteractionFilter message declares city_id and search_query with a
  // minimum length and no ignore rule, so the validation interceptor rejects
  // any filter that narrows only by type. The proto is fixed in
  // loci-connect-proto; until that module is released the chips narrow what has
  // been loaded, and "Load more" widens the pool they work over.
  const visibleEntries = createMemo(() => {
    const filterId = typeFilter();
    const query = searchQuery().trim().toLowerCase();
    return allEntries().filter((entry) => {
      if (!matchesType(entry, filterId)) return false;
      if (!query) return true;
      return (
        entry.label.toLowerCase().includes(query) || entry.cityName.toLowerCase().includes(query)
      );
    });
  });

  const counts = createMemo(() => {
    const out: Record<string, number> = {};
    for (const option of ACTIVITY_TYPE_OPTIONS) {
      if (option.id === "all") continue;
      out[option.id] = allEntries().filter((e) => matchesType(e, option.id)).length;
    }
    return out;
  });

  const groups = createMemo(() => bucketByDay(visibleEntries(), now));

  const isFiltered = () => typeFilter() !== "all" || searchQuery().trim() !== "";
  const hasMore = () => Boolean(activityQuery.data?.hasMore);
  // Growing the page count refetches a longer range under a new key, so the
  // query reports loading while the existing list stays on screen.
  const isLoadingMore = () => pages() > 1 && activityQuery.isFetching;

  const setView = (next: "feed" | "cities") => {
    setParams({ view: next === "feed" ? undefined : next }, { replace: true });
  };

  return (
    <div class="min-h-screen bg-background transition-colors">
      <div class="border-b border-border bg-card">
        <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 class="flex items-center gap-2 text-2xl font-bold text-foreground">
                <RotateCcw class="h-6 w-6 text-primary" />
                Recent activity
              </h1>
              <p class="mt-1 text-muted-foreground">
                Everything you asked, saved and kept, newest first.
              </p>
            </div>

            <div class="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              <ViewTab
                active={view() === "feed"}
                onClick={() => setView("feed")}
                icon={<History class="h-4 w-4" />}
                label="Feed"
              />
              <ViewTab
                active={view() === "cities"}
                onClick={() => setView("cities")}
                icon={<MapPin class="h-4 w-4" />}
                label="Cities"
              />
            </div>
          </div>
        </div>
      </div>

      <Show when={view() === "feed"} fallback={<CitiesView />}>
        <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div class="mb-6 space-y-4">
            <div class="relative max-w-md">
              <Search class="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <TextFieldRoot class="w-full">
                <TextField
                  type="text"
                  placeholder="Search your activity…"
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  class="pl-10"
                />
              </TextFieldRoot>
            </div>

            <ActivityTypeChips value={typeFilter()} onChange={setTypeFilter} counts={counts()} />
          </div>

          <ActivityFeed
            groups={groups()}
            now={now}
            profileId={profileId()}
            isLoading={activityQuery.isLoading}
            isError={activityQuery.isError}
            onRetry={() => activityQuery.refetch()}
            hasMore={hasMore()}
            isLoadingMore={isLoadingMore()}
            onLoadMore={() => setPages((p) => p + 1)}
            isFiltered={isFiltered()}
          />

          <Show when={!activityQuery.isLoading && allEntries().length >= ACTIVITY_PAGE_SIZE}>
            <p class="mt-6 text-center text-xs text-muted-foreground">
              Showing your {allEntries().length} most recent actions.
            </p>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function ViewTab(props: {
  active: boolean;
  onClick: () => void;
  icon: JSX.Element;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      class={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        props.active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {props.icon}
      {props.label}
    </button>
  );
}
