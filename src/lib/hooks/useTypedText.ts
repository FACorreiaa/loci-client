import { createEffect, createSignal, on, onCleanup } from "solid-js";

/**
 * Types `source()` out when it arrives live; shows it whole otherwise.
 *
 * Only structured text goes through here — a city description, an itinerary
 * summary — once its event has landed. Raw LLM tokens are never shown: three
 * workers stream JSON fragments into one channel with no part label, so
 * typing them out would be typing JSON.
 *
 * Append-only, chunked: a 600-character description at one char per frame is
 * ten seconds of waiting, so it advances a few characters per tick and lands
 * in about two. Reduced-motion users and restored sessions get the text at
 * once.
 */
export function useTypedText(
  source: () => string | undefined | null,
  live: () => boolean,
  opts: { charsPerTick?: number; tickMs?: number } = {},
): () => string {
  const charsPerTick = opts.charsPerTick ?? 4;
  const tickMs = opts.tickMs ?? 16;
  const [text, setText] = createSignal("");
  let timer: ReturnType<typeof setInterval> | undefined;

  const reducedMotion = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
  };

  createEffect(
    on(source, (next) => {
      stop();
      const full = next ?? "";
      if (!full || !live() || reducedMotion()) {
        setText(full);
        return;
      }
      // Continue from a common prefix rather than restarting: the summary can
      // be re-sent unchanged when a later event carries the same aggregate.
      let i = 0;
      const cur = text();
      while (i < cur.length && i < full.length && cur[i] === full[i]) i++;
      setText(full.slice(0, i));
      timer = setInterval(() => {
        i = Math.min(full.length, i + charsPerTick);
        setText(full.slice(0, i));
        if (i >= full.length) stop();
      }, tickMs);
    }),
  );

  onCleanup(stop);
  return text;
}
