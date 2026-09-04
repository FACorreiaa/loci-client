import { A } from "@solidjs/router";
import type { Component, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { ArrowRight, Lock } from "lucide-solid";

interface RegisterBannerProps {
  title: string;
  description: string;
  badge?: string;
  ctaLabel?: string;
  ctaHref?: string;
  icon?: Component;
  helper?: JSX.Element;
}

export default function RegisterBanner(props: RegisterBannerProps): JSX.Element {
  const icon = () => props.icon || Lock;

  return (
    <div class="loci-card flex flex-col gap-3 p-5 sm:p-6">
      <div class="flex items-center gap-3">
        <div class="rounded-2xl border border-border bg-secondary p-3 text-primary">
          <Dynamic component={icon()} class="w-5 h-5" />
        </div>
        <div>
          {/* Was text-blue-700/80 with a dark:slate override — a hardcoded pair that
              measured 4.45:1 once the card moved to a translucent background, just
              under the 4.5 minimum. The kicker token is theme-aware and passes. */}
          <p class="kicker">{props.badge || "Preview mode"}</p>
          <h3 class="text-lg font-semibold text-foreground">{props.title}</h3>
        </div>
      </div>

      <p class="text-sm leading-relaxed text-muted-foreground">{props.description}</p>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <A
          href={props.ctaHref || "/auth/signin"}
          class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {props.ctaLabel || "Register to unlock"}
          <ArrowRight class="w-4 h-4" />
        </A>
        {props.helper}
      </div>
    </div>
  );
}
