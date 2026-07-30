import { Component, For, Show, createSignal, onMount } from "solid-js";
import { A } from "@solidjs/router";
import { Button } from "@/ui/button";
import { Wifi, RefreshCw, Map, Trash2 } from "lucide-solid";
import {
  clearOfflineTripCache,
  listCachedTrips,
  type CachedTripSummary,
} from "~/lib/trip-offline-cache";

const OfflinePage: Component = () => {
  const [cached, setCached] = createSignal<CachedTripSummary[]>([]);

  const refresh = () => setCached(listCachedTrips());

  onMount(refresh);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleClear = () => {
    clearOfflineTripCache();
    refresh();
  };

  return (
    <div class="min-h-screen flex items-center justify-center px-4 bg-background py-12">
      <div class="w-full max-w-md mx-auto px-6 loci-card py-8">
        <div class="text-center">
          <div class="w-20 h-20 mx-auto mb-6 bg-primary rounded-full flex items-center justify-center shadow-lg ring-4 ring-border">
            <Wifi class="w-10 h-10 text-primary-foreground" />
          </div>

          <h1 class="text-2xl font-bold text-foreground mb-4">You're Offline</h1>

          <p class="text-muted-foreground mb-6 leading-relaxed">
            Connection lost. Open a trip while online and it stays available here for later.
          </p>

          <Button
            onClick={handleRetry}
            class="w-full py-3 font-semibold flex items-center justify-center gap-2 mb-6"
          >
            <RefreshCw class="w-5 h-5" />
            Try Again
          </Button>
        </div>

        <div class="border-t border-border pt-5">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Map class="h-3.5 w-3.5" />
              Cached trips
            </h2>
            <Show when={cached().length > 0}>
              <button
                type="button"
                class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              >
                <Trash2 class="h-3 w-3" />
                Clear
              </button>
            </Show>
          </div>

          <Show
            when={cached().length > 0}
            fallback={
              <p class="text-sm text-muted-foreground">
                No trips cached yet. Visit a trip page while online to save it for offline.
              </p>
            }
          >
            <ul class="space-y-2">
              <For each={cached()}>
                {(t) => (
                  <li>
                    <A
                      href={`/trips/${t.id}`}
                      class="block rounded-lg border border-border px-3 py-2.5 text-left transition hover:bg-muted/50"
                    >
                      <span class="font-medium text-foreground">{t.title}</span>
                      <p class="text-xs text-muted-foreground">
                        {t.cityName || "Trip"} · {t.dayCount} day
                        {t.dayCount === 1 ? "" : "s"}
                      </p>
                    </A>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default OfflinePage;
