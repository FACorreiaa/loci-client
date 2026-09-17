// The moving strip: destinations with a reason to go this month, plus the
// cities people asked about this week. Tapping one writes the request into the
// hero box above; nothing is generated until the person presses Discover.
// Under reduced motion, or with too few items to fill a row, it is a plain
// scrollable row instead of a marquee.
import { For, Show, createMemo, onMount, createSignal } from "solid-js";
import { useTrendingDiscoveries } from "~/lib/api/discover";
import {
  buildInSeasonItems,
  marqueeDurationSeconds,
  needsMarquee,
  type InSeasonItem,
} from "~/lib/dashboard/in-season";
import { monthLabel, picksForMonth } from "~/lib/dashboard/seasons";
import { requestHeroPrompt } from "~/lib/dashboard/hero-prompt";
import { flagFor } from "~/lib/news/ticker";
import { prefersReducedMotion } from "~/lib/hooks/useInView";

function TripChip(props: { item: InSeasonItem; decorative?: boolean }) {
  return (
    <button
      type="button"
      tabindex={props.decorative ? -1 : undefined}
      onClick={() => requestHeroPrompt(props.item.prompt)}
      aria-label={`Plan ${props.item.city}: ${props.item.hook}`}
      class="loci-chip--surface loci-marquee__item inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm active:scale-[0.98]"
    >
      <span aria-hidden="true">{props.item.emoji}</span>
      <Show when={flagFor(props.item.countryCode)}>
        {(f) => <span aria-hidden="true">{f()}</span>}
      </Show>
      <span class="font-medium">{props.item.city}</span>
      <span class="text-muted-foreground">· {props.item.hook}</span>
      <Show when={props.item.planned > 0 && props.item.hook !== "planned this week"}>
        <span class="text-[11px] text-muted-foreground">
          · {props.item.planned} planned this week
        </span>
      </Show>
    </button>
  );
}

export default function InSeasonBand() {
  const query = useTrendingDiscoveries(8);
  const now = new Date();
  const items = createMemo(() => buildInSeasonItems(picksForMonth(now.getMonth() + 1), query.data));

  // False during SSR, so the first paint carries the marquee markup and the
  // CSS media query in motion-tokens.css is what holds it still.
  const [reduced, setReduced] = createSignal(false);
  onMount(() => setReduced(prefersReducedMotion()));
  const moving = () => !reduced() && needsMarquee(items().length);

  return (
    <Show when={items().length > 0}>
      <section class="mb-6" aria-label="In season">
        <div class="loci-marquee">
          <div class="loci-marquee__label font-coord text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            In season · {monthLabel(now)}
          </div>
          <Show
            when={moving()}
            fallback={
              <div class="loci-marquee__viewport flex snap-x gap-2 overflow-x-auto py-2 [scrollbar-width:thin]">
                <For each={items()}>{(item) => <TripChip item={item} />}</For>
              </div>
            }
          >
            <div class="loci-marquee__viewport">
              <div
                class="loci-marquee__track"
                style={{ "--loci-marquee-duration": `${marqueeDurationSeconds(items().length)}s` }}
              >
                <For each={items()}>{(item) => <TripChip item={item} />}</For>
                <div class="contents" aria-hidden="true">
                  <For each={items()}>{(item) => <TripChip item={item} decorative />}</For>
                </div>
              </div>
            </div>
          </Show>
        </div>
        <p class="mt-1 text-[11px] text-muted-foreground">Tap one to start it in the box above.</p>
      </section>
    </Show>
  );
}
