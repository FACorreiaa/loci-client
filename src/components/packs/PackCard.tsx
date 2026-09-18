import { Show } from "solid-js";
import { A } from "@solidjs/router";
import { MapPin, Lock, Check } from "lucide-solid";
import type { PackSummary } from "~/lib/api/bundles";
import { monthsLabel, priceLabel, themeLabel } from "~/lib/bundles/themes";

/** One pack in the catalog grid. */
export default function PackCard(props: { pack: PackSummary }) {
  const p = () => props.pack;

  return (
    <li class="loci-card overflow-hidden transition-shadow hover:shadow-md">
      <A
        href={`/packs/${p().slug}`}
        class="block p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-coord text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              {p().cityName}
            </p>
            <h3 class="mt-1 text-lg font-semibold leading-snug text-foreground">{p().title}</h3>
          </div>

          <Show
            when={p().isPaid && !p().owned}
            fallback={
              <span class="loci-chip loci-chip--surface shrink-0 gap-1">
                <Show when={p().owned && p().isPaid} fallback={<>Free</>}>
                  <Check class="h-3 w-3" aria-hidden="true" /> Yours
                </Show>
              </span>
            }
          >
            <span class="loci-chip loci-chip--surface shrink-0 gap-1">
              <Lock class="h-3 w-3" aria-hidden="true" />
              {priceLabel(p().priceCents, p().currency)}
            </span>
          </Show>
        </div>

        <Show when={p().summary}>
          <p class="mt-2 line-clamp-2 text-sm text-muted-foreground">{p().summary}</p>
        </Show>

        <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span class="loci-chip loci-chip--surface">{themeLabel(p().theme)}</span>
          <span class="loci-chip loci-chip--surface">{monthsLabel(p().months)}</span>
          <span class="inline-flex items-center gap-1">
            <MapPin class="h-3 w-3" aria-hidden="true" />
            {p().dayCount} {p().dayCount === 1 ? "day" : "days"} · {p().stopCount} stops
          </span>
        </div>
      </A>
    </li>
  );
}
