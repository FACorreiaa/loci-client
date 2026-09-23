import { Show, createSignal, createEffect, on, type JSX } from "solid-js";
import { Star, MapPin, Clock, ChevronRight, Copyright } from "lucide-solid";
import ProgressiveImage from "./ProgressiveImage";
import type { ItineraryStop } from "@/lib/itinerary/createItineraryStream";
import { cn } from "@/cn";

const categoryEmoji = (category = "") => {
  const c = category.toLowerCase();
  if (c.includes("museum")) return "🏛️";
  if (c.includes("park") || c.includes("garden")) return "🌳";
  if (c.includes("beach")) return "🏖️";
  if (c.includes("historic") || c.includes("castle")) return "🏰";
  if (c.includes("church") || c.includes("cathedral")) return "⛪";
  if (c.includes("market")) return "🛒";
  if (c.includes("hotel") || c.includes("hostel") || c.includes("ryokan")) return "🏨";
  if (c.includes("restaurant") || c.includes("food") || c.includes("bar")) return "🍽️";
  if (c.includes("view") || c.includes("lookout")) return "👁️";
  if (c.includes("shop")) return "🛍️";
  return "📍";
};

export interface StopCardProps {
  stop: ItineraryStop;
  index: number;
  onClick?: (stop: ItineraryStop) => void;
  /** Highlighted + scrolled into view when its map marker is selected. */
  selected?: boolean;
  /**
   * Domain facts under the blurb — a hotel's stars and amenities, a
   * restaurant's cuisine and hours. The card stays one component; what a
   * kind of place says about itself is the caller's.
   */
  meta?: JSX.Element;
  /** A control at the trailing edge, e.g. a favourite button. */
  action?: JSX.Element;
}

/**
 * Editorial stop card. Renders fully from the text skeleton; the image
 * (and rating chip) fill in when enrichment lands. A one-shot accent
 * bloom marks the moment a card goes from skeleton → real.
 */
export default function StopCard(props: StopCardProps) {
  const [bloom, setBloom] = createSignal(false);
  let cardRef: HTMLDivElement | undefined;

  // Scroll into view when this card becomes the selected one (map -> list sync).
  createEffect(
    on(
      () => props.selected,
      (selected, prev) => {
        if (selected && !prev) {
          cardRef?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      },
      { defer: true },
    ),
  );

  // Fire the bloom exactly once, on the false → true enrichment edge.
  createEffect(
    on(
      () => props.stop.enriched,
      (enriched, prev) => {
        if (enriched && prev === false) {
          setBloom(true);
          const t = setTimeout(() => setBloom(false), 900);
          return () => clearTimeout(t);
        }
      },
      { defer: true },
    ),
  );

  const interactive = () => Boolean(props.onClick);

  // The picture's credit, as the licence requires it: author and licence,
  // and the source page when there is one. Shown as a small mark that reads
  // in full on hover/focus, so the card stays a card.
  const credit = () => props.stop.imageCredit;
  const creditText = () => {
    const c = credit();
    if (!c) return "";
    return [c.attribution, c.licence].filter(Boolean).join(" · ");
  };

  return (
    <div
      ref={cardRef}
      class={cn(
        "editorial-card stop-enter relative flex gap-4 p-3 sm:p-4 transition-shadow",
        bloom() && "enrich-bloom",
        interactive() && "cursor-pointer",
        props.selected && "ring-2 ring-accent ring-offset-2 ring-offset-background",
      )}
      style={{ "--i": String(Math.min(props.index, 14)) }}
      onClick={() => props.onClick?.(props.stop)}
      onKeyDown={(e) => {
        if (interactive() && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          props.onClick?.(props.stop);
        }
      }}
      role={interactive() ? "button" : undefined}
      tabindex={interactive() ? 0 : undefined}
      aria-pressed={interactive() ? props.selected : undefined}
    >
      {/* Image / placeholder */}
      <div class="relative shrink-0">
        <ProgressiveImage
          src={props.stop.imageUrl}
          alt={props.stop.name}
          seed={props.stop.key}
          class="w-[88px] h-[88px] sm:w-28 sm:h-28 rounded-xl"
        />
        {/* index stamp */}
        <div class="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center shadow-sm">
          <span class="stop-stamp text-xs">{props.index + 1}</span>
        </div>
        {/* rating chip — only once enriched */}
        <Show when={props.stop.rating}>
          <div class="absolute bottom-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-background/90 backdrop-blur text-[11px] font-semibold">
            <Star class="w-3 h-3 text-accent fill-current" />
            {props.stop.rating!.toFixed(1)}
          </div>
        </Show>
        {/* image credit — only when the picture carries one */}
        <Show when={credit() && props.stop.imageUrl}>
          <Show
            when={credit()!.source_page_url}
            fallback={
              <span
                class="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground backdrop-blur"
                title={creditText()}
                aria-label={`Image credit: ${creditText()}`}
                role="img"
              >
                <Copyright class="h-3 w-3" />
              </span>
            }
          >
            {(href) => (
              <a
                href={href()}
                target="_blank"
                rel="noopener noreferrer"
                class="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground backdrop-blur hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                title={creditText()}
                aria-label={`Image credit: ${creditText()} (opens source)`}
                onClick={(e) => e.stopPropagation()}
              >
                <Copyright class="h-3 w-3" />
              </a>
            )}
          </Show>
        </Show>
      </div>

      {/* Content */}
      <div class="flex-1 min-w-0 self-center">
        <Show when={props.stop.category}>
          <p class="kicker mb-1 truncate">
            {categoryEmoji(props.stop.category)} {props.stop.category}
          </p>
        </Show>

        <h3 class="editorial-title text-base sm:text-lg text-foreground truncate">
          {props.stop.name}
        </h3>

        <Show when={props.stop.blurb}>
          <p class="editorial-lead text-sm mt-1 line-clamp-2">{props.stop.blurb}</p>
        </Show>

        <Show when={props.meta}>
          <div class="mt-2 text-xs text-muted-foreground">{props.meta}</div>
        </Show>

        <div class="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <Show when={props.stop.timeToSpend}>
            <span class="inline-flex items-center gap-1">
              <Clock class="w-3.5 h-3.5" />
              {props.stop.timeToSpend}
            </span>
          </Show>
          <Show when={typeof props.stop.distance === "number"}>
            <span class="inline-flex items-center gap-1">
              <MapPin class="w-3.5 h-3.5" />
              {props.stop.distance}km
            </span>
          </Show>
          <Show when={props.stop.budget}>
            <span class="font-semibold text-accent">{props.stop.budget}</span>
          </Show>
        </div>
      </div>

      <Show when={props.action}>
        <div class="self-center shrink-0" onClick={(e) => e.stopPropagation()}>
          {props.action}
        </div>
      </Show>

      <Show when={interactive()}>
        <ChevronRight class="w-5 h-5 text-muted-foreground self-center shrink-0" />
      </Show>
    </div>
  );
}
