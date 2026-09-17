// The per-user switch for the desk's breaking-news band.
import { Show } from "solid-js";
import { Newspaper } from "lucide-solid";
import { useNewsTicker, useSetNewsTickerEnabled } from "~/lib/api/newsTicker";

export default function NewsTickerToggle() {
  const ticker = useNewsTicker();
  const setEnabled = useSetNewsTickerEnabled();
  const enabled = () => ticker.data?.enabled ?? true;

  return (
    <section id="news" class="rounded-2xl border border-border/60 bg-card p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="flex gap-3">
          <Newspaper class="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h3 class="text-sm font-medium text-foreground">Breaking news on your desk</h3>
            <p class="mt-1 text-xs text-muted-foreground">
              Headlines for your home country, your next destination and places you have been. From publishers'
              own feeds; links open the publisher.
            </p>
          </div>
        </div>
        <label class="flex cursor-pointer items-center gap-2 text-xs">
          <span class="sr-only">Show breaking news</span>
          <input
            type="checkbox"
            role="switch"
            class="h-5 w-9 accent-primary"
            checked={enabled()}
            disabled={setEnabled.isPending}
            aria-checked={enabled()}
            onChange={(e) => setEnabled.mutate(e.currentTarget.checked)}
          />
        </label>
      </div>
      <Show when={setEnabled.isError}>
        <p class="mt-3 text-xs text-destructive">Could not save that. Try again.</p>
      </Show>
    </section>
  );
}
