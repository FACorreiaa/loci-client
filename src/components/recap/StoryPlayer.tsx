import { For, Show, createMemo, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { X } from "lucide-solid";
import type { Recap, RecapCard } from "~/lib/api/recap";
import { isLightCard, playableCards } from "~/lib/recap/recap";
import { RecapCardView } from "./RecapCards";
import "./recap.css";

/** How long each card stays up before the next one. */
const CARD_MS = 7000;
/** Holding longer than this pauses instead of tapping. */
const HOLD_MS = 220;
/** A downward drag this long closes the player. */
const SWIPE_CLOSE_PX = 90;

export interface StoryPlayerProps {
  recap: Recap;
  /** Close button and Esc / swipe down; hidden when absent. */
  onClose?: () => void;
  /** Buttons under the current card (save image, share link). */
  actions?: (card: RecapCard, index: number) => JSX.Element;
  /** Extra content at the bottom of the closing card (a CTA on a shared recap). */
  outroFooter?: JSX.Element;
  /** Called once per card shown, for analytics. */
  onCardShown?: (card: RecapCard, index: number) => void;
}

/**
 * Plays a recap as full-screen story cards: tap right for the next card,
 * left for the previous one, hold to pause. Each card's progress bar is a CSS
 * animation and its `animationend` advances the story, so pausing (which
 * pauses every animation in the player) pauses the clock with it.
 */
export default function StoryPlayer(props: StoryPlayerProps) {
  const cards = createMemo(() => playableCards(props.recap.cards));
  const [index, setIndex] = createSignal(0);
  const [paused, setPaused] = createSignal(false);
  const current = () => cards()[index()];
  let root: HTMLDivElement | undefined;

  const go = (i: number) => {
    const n = cards().length;
    if (n === 0) return;
    setIndex(Math.max(0, Math.min(n - 1, i)));
    props.onCardShown?.(cards()[index()], index());
  };
  const next = () => {
    if (index() < cards().length - 1) go(index() + 1);
    else setPaused(true);
  };
  const prev = () => go(index() - 1);

  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let held = false;
  let startY = 0;
  const onPointerDown = (e: PointerEvent) => {
    held = false;
    startY = e.clientY;
    holdTimer = setTimeout(() => {
      held = true;
      setPaused(true);
    }, HOLD_MS);
  };
  const onPointerUp = (e: PointerEvent) => {
    clearTimeout(holdTimer);
    if (props.onClose && e.clientY - startY > SWIPE_CLOSE_PX) {
      props.onClose();
      return;
    }
    if (held) {
      held = false;
      setPaused(false);
      return;
    }
    const zone = (e.target as HTMLElement).closest<HTMLElement>("[data-zone]");
    if (!zone) return;
    if (zone.dataset.zone === "next") next();
    else prev();
  };
  const onPointerLeave = () => {
    clearTimeout(holdTimer);
    if (held) {
      held = false;
      setPaused(false);
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === " ") {
      e.preventDefault();
      setPaused((p) => !p);
    } else if (e.key === "Escape" && props.onClose) {
      e.preventDefault();
      props.onClose();
    }
  };

  onMount(() => {
    root?.focus();
    props.onCardShown?.(cards()[0], 0);
    const onVisibility = () => document.hidden && setPaused(true);
    document.addEventListener("visibilitychange", onVisibility);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.body.style.overflow = overflow;
      clearTimeout(holdTimer);
    });
  });

  return (
    <div class="rc rc-overlay">
      <div
        ref={root}
        class="rc-player"
        tabindex="0"
        role="region"
        aria-roledescription="story"
        aria-label={`${props.recap.title} recap`}
        data-paused={paused() ? "" : undefined}
        data-light={isLightCard(current()) ? "" : undefined}
        style={{ "--rc-dur": `${CARD_MS}ms` }}
        onKeyDown={onKey}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        <Show when={current()} keyed>
          {(card) => (
            <div aria-live="polite" aria-label={`Card ${index() + 1} of ${cards().length}`}>
              <RecapCardView recap={props.recap} card={card} outroFooter={props.outroFooter} />
            </div>
          )}
        </Show>

        <div class="rc-bars" aria-hidden="true">
          <For each={cards()}>
            {(_, i) => (
              <div
                class="rc-bar"
                data-state={i() < index() ? "done" : i() === index() ? "on" : ""}
                onAnimationEnd={() => i() === index() && next()}
              >
                <i />
              </div>
            )}
          </For>
        </div>
        <div class="rc-top">
          <span class="rc-mark">Loci</span>
          <Show when={paused()}>
            <span>Paused</span>
          </Show>
          <Show when={props.onClose}>
            <button
              type="button"
              class="rc-close"
              aria-label="Close recap"
              onClick={() => props.onClose?.()}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </Show>
        </div>

        <div class="rc-zones" aria-hidden="true">
          <div data-zone="prev" />
          <div data-zone="next" />
        </div>

        <Show when={props.actions && current()}>
          <div
            class="rc-actions"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {props.actions!(current()!, index())}
          </div>
        </Show>
      </div>
      <p class="sr-only">Use the arrow keys to move between cards and space to pause.</p>
    </div>
  );
}
