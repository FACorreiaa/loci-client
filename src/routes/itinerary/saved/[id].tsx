import { For, Show } from "solid-js";
import { A, useNavigate, useParams } from "@solidjs/router";
import { AlertCircle, ArrowLeft, CalendarDays, Clock, Map, RefreshCw, Trash2 } from "lucide-solid";
import { useItinerary, useRemoveItineraryMutation } from "~/lib/api/itineraries";
import { savedItineraryHref } from "~/lib/saved-itineraries";
import { decodeParam } from "~/lib/saved/collect";
import { ShareMenu } from "~/components/ShareMenu";
import { SHARE_HOME_URL } from "~/lib/share";
import { Skeleton } from "~/ui/skeleton";

const BACK = "/saved?view=itineraries";

const formatDate = (iso: string | undefined) => {
  const d = new Date(iso ?? "");
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
};

const COST = ["", "Budget", "Moderate", "Pricey", "Luxury"];

/**
 * An itinerary saved to the account with no copy on this device. Whatever the
 * server kept is shown here; when it kept the session the plan came from, the
 * full plan opens in the planner, which fetches it from the server.
 */
export default function SavedItineraryPage() {
  const params = useParams();
  const navigate = useNavigate();
  const id = () => decodeParam(params.id);
  const query = useItinerary(id());
  const remove = useRemoveItineraryMutation();

  // Guarded read: `.data` while pending suspends the whole route.
  const it = () => (query.isSuccess ? query.data : undefined);
  const notFound = () =>
    query.isError && /not.?found/i.test(query.error instanceof Error ? query.error.message : "");

  const onRemove = async () => {
    await remove.mutateAsync(id());
    navigate(BACK, { replace: true });
  };

  return (
    <div class="min-h-screen bg-background">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <A
          href={BACK}
          class="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft class="w-4 h-4" aria-hidden="true" />
          Back to Saved
        </A>

        <Show when={query.isPending}>
          <div class="space-y-3" aria-busy="true" aria-label="Loading">
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-9 w-2/3" />
            <Skeleton class="h-4 w-1/2" />
            <Skeleton class="h-40 w-full rounded-2xl" />
          </div>
        </Show>

        <Show when={query.isError}>
          <Show
            when={!notFound()}
            fallback={
              <div class="loci-card rounded-2xl p-8 text-center space-y-3">
                <p class="text-3xl">🗺️</p>
                <p class="font-display text-xl text-foreground">We couldn't find that itinerary</p>
                <p class="text-sm text-muted-foreground">
                  It may have been removed from your account.
                </p>
                <A href={BACK} class="loci-hero__action mx-auto">
                  Back to Saved
                </A>
              </div>
            }
          >
            <div
              role="alert"
              class="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive flex items-start gap-3"
            >
              <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div class="min-w-0">
                <p class="font-bold">Couldn't load this itinerary</p>
                <p class="text-sm opacity-90">
                  {query.error instanceof Error ? query.error.message : "Something went wrong."}
                </p>
                <button
                  type="button"
                  onClick={() => void query.refetch()}
                  class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2 hover:no-underline"
                >
                  <RefreshCw class="w-3.5 h-3.5" aria-hidden="true" />
                  Try again
                </button>
              </div>
            </div>
          </Show>
        </Show>

        <Show when={it()}>
          {(i) => (
            <article>
              <p class="kicker mb-1">🗺️ Saved itinerary</p>
              <div class="flex items-start justify-between gap-3">
                <h1 class="editorial-title text-2xl sm:text-3xl text-foreground min-w-0">
                  {i().title || "Untitled"}
                </h1>
                <div class="flex items-center gap-1 shrink-0">
                  <ShareMenu
                    payload={{
                      cityName: "",
                      title: i().title,
                      description: i().description,
                      url: SHARE_HOME_URL,
                    }}
                  />
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => void onRemove()}
                    class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label={`Remove ${i().title || "itinerary"} from Saved`}
                    title="Remove from Saved"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <Show when={formatDate(i().created_at)}>
                  <span class="inline-flex items-center gap-1.5">
                    <CalendarDays class="w-4 h-4" aria-hidden="true" />
                    Saved {formatDate(i().created_at)}
                  </span>
                </Show>
                <Show when={i().estimated_duration_days}>
                  <span class="inline-flex items-center gap-1.5">
                    <Clock class="w-4 h-4" aria-hidden="true" />
                    {i().estimated_duration_days}{" "}
                    {i().estimated_duration_days === 1 ? "day" : "days"}
                  </span>
                </Show>
                <Show when={COST[i().estimated_cost_level ?? 0]}>
                  <span>{COST[i().estimated_cost_level ?? 0]}</span>
                </Show>
              </div>

              <Show when={i().session_id}>
                {(sessionId) => (
                  <A
                    href={savedItineraryHref(sessionId(), "")}
                    class="loci-hero__action mt-6 inline-flex items-center gap-2"
                  >
                    <Map class="w-4 h-4" aria-hidden="true" />
                    Open the full plan
                  </A>
                )}
              </Show>

              <Show when={i().description}>
                <p class="mt-6 text-foreground leading-relaxed">{i().description}</p>
              </Show>

              <Show when={i().markdown_content}>
                <section class="mt-6 bg-card rounded-2xl p-6 border border-border">
                  <p class="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {i().markdown_content}
                  </p>
                </section>
              </Show>

              <Show when={i().tags?.length}>
                <ul class="mt-6 flex flex-wrap gap-2" aria-label="Tags">
                  <For each={i().tags}>
                    {(t) => (
                      <li class="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                        {t}
                      </li>
                    )}
                  </For>
                </ul>
              </Show>

              <Show when={!i().session_id && !i().description && !i().markdown_content}>
                <p class="mt-6 text-sm text-muted-foreground">
                  Only the title was kept for this one. Plan the trip again and save it to keep the
                  full plan on every device.
                </p>
              </Show>
            </article>
          )}
        </Show>
      </div>
    </div>
  );
}
