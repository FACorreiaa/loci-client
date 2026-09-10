// Brand marks for the agents and model providers Loci connects to.
//
// One component per brand, ported from north-web-app; `BrandIcon` maps the
// strings the rest of the app uses (an API key's `clientKind`, a provider id)
// onto them so call sites never switch on brand names themselves.
import { Plug } from "lucide-solid";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import Anthropic from "./Anthropic";
import Claude from "./Claude";
import Gemini from "./Gemini";
import Google from "./Google";
import Grok from "./Grok";
import Hermes from "./Hermes";
import Nvidia from "./Nvidia";
import OpenAI from "./OpenAI";
import OpenRouter from "./OpenRouter";
import type { BrandIconProps } from "./props";

export type { BrandIconProps } from "./props";
export { Anthropic, Claude, Gemini, Google, Grok, Hermes, Nvidia, OpenAI, OpenRouter };

/**
 * Names `BrandIcon` resolves to a real mark. Anything else — including
 * `cursor`, whose official mark is not vendored yet — falls back to a plug.
 */
export const BRAND_NAMES = [
  "claude_code",
  "claude_desktop",
  "claude",
  "anthropic",
  "codex",
  "openai",
  "xai",
  "grok",
  "hermes",
  "nvidia",
  "gemini",
  "google",
  "openrouter",
] as const;

export type BrandName = (typeof BRAND_NAMES)[number];

const MARKS: Record<BrandName, Component<BrandIconProps>> = {
  // Claude Code and Claude Desktop are the product; the burst is its mark.
  claude_code: Claude,
  claude_desktop: Claude,
  claude: Claude,
  anthropic: Anthropic,
  codex: OpenAI,
  openai: OpenAI,
  xai: Grok,
  grok: Grok,
  hermes: Hermes,
  nvidia: Nvidia,
  gemini: Gemini,
  google: Google,
  openrouter: OpenRouter,
};

function isBrandName(name: string): name is BrandName {
  return Object.hasOwn(MARKS, name);
}

/** The mark for an agent or provider, by the id the app already uses for it. */
export function BrandIcon(props: { name: string; class?: string; label?: string }) {
  return (
    <Dynamic
      component={isBrandName(props.name) ? MARKS[props.name] : Plug}
      class={props.class}
      {...(props.label ? { "aria-label": props.label, role: "img" } : { "aria-hidden": "true" })}
    />
  );
}
