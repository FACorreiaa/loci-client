/**
 * A one-way channel from anything on the desk to the hero's question box.
 * The nonce changes on every request so tapping the same trip twice still
 * refocuses the box. Nonce 0 is the untouched initial state; the hero ignores it.
 */
import { createSignal } from "solid-js";

export interface HeroPromptRequest {
  text: string;
  nonce: number;
}

const [heroPrompt, setHeroPrompt] = createSignal<HeroPromptRequest>({ text: "", nonce: 0 });

export const requestHeroPrompt = (text: string): void => {
  setHeroPrompt((prev) => ({ text, nonce: prev.nonce + 1 }));
};

export { heroPrompt };
