import { For, Show, createMemo } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { ChevronLeft, Footprints, Trash2 } from "lucide-solid";
import { ProtectedRoute } from "~/contexts/AuthContext";
import {
  useDeleteVisitedPlace,
  useVisitedPlaces,
  type VisitSourceName,
} from "~/lib/api/travel-history";
import { groupVisitsByCity } from "~/lib/visited/group";

const SOURCE_LABEL: Record<VisitSourceName, string> = {
  visit_event: "Walked",
  manual: "Added",
  trip: "From a trip",
  backfill: "From history",
  unknown: "",
};

const formatDate = (d?: Date) =>
  d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

/**
 * Places I've been: every place visit Loci has on record, by city. This is
 * the diary side of the globe: the globe shows cities, this shows the places,
 * and each one is a signal the taste profile learned from.
 */
function VisitedContent() {
  const visited = useVisitedPlaces();
  const remove = useDeleteVisitedPlace();
  const groups = createMemo(() => groupVisitsByCity(visited.data?.places ?? []));

  return (
    <>
      <Title>Places I've been · Loci</Title>
      <Meta name="robots" content="noindex" />
      <main class="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <A
          href="/globe"
          class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft class="w-4 h-4" />
          Where you've been
        </A>

        <header class="mb-8">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Footprints class="w-5 h-5 text-primary" />
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold text-foreground">Places I've been</h1>
          </div>
          <p class="text-muted-foreground text-sm sm:text-base">
            Every place you walked to or marked as been-there. Loci learns your taste from these;
            remove one and it forgets that too.
          </p>
        </header>

        <Show
          when={!visited.isPending}
          fallback={<p class="text-sm text-muted-foreground">Loading…</p>}
        >
          <Show
            when={groups().length > 0}
            fallback={
              <p class="loci-card rounded-3xl p-6 text-sm text-muted-foreground">
                Places you visit or mark as been-there show up here. Open any place and tap "I've
                been here".
              </p>
            }
          >
            <div class="space-y-6">
              <For each={groups()}>
                {(group) => (
                  <section class="loci-card rounded-3xl p-5 sm:p-6">
                    <h2 class="kicker mb-3">
                      {group.city} · {group.places.length}
                    </h2>
                    <ul class="divide-y divide-border">
                      <For each={group.places}>
                        {(place) => (
                          <li class="flex items-center justify-between gap-3 py-2.5">
                            <span class="min-w-0 truncate text-foreground">
                              {place.poiName || "Unnamed place"}
                            </span>
                            <span class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                              <Show when={SOURCE_LABEL[place.source]}>
                                <span class="rounded-full border border-border px-2 py-0.5">
                                  {SOURCE_LABEL[place.source]}
                                </span>
                              </Show>
                              {formatDate(place.visitedAt)}
                              <button
                                type="button"
                                class="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted hover:text-foreground"
                                aria-label={`Remove ${place.poiName || "this place"} from places you've been`}
                                title="Remove — Loci also forgets what it learned from it"
                                onClick={() => remove.mutate(place.id)}
                              >
                                <Trash2 class="h-3.5 w-3.5" />
                              </button>
                            </span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </section>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </main>
    </>
  );
}

export default function VisitedPlaces() {
  return (
    <ProtectedRoute>
      <VisitedContent />
    </ProtectedRoute>
  );
}
