import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { cn } from "~/lib/utils";

interface SectionCardProps {
  title: string;
  description?: string;
  /** Rendered beside the title, e.g. a "Connected" badge. */
  aside?: JSX.Element;
  class?: string;
  children: JSX.Element;
}

/** One concern per card, each saving on its own, so a failure names its card. */
export function SectionCard(props: SectionCardProps) {
  return (
    <section
      class={cn("space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6", props.class)}
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 space-y-1">
          <h2 class="text-base font-semibold text-foreground">{props.title}</h2>
          <Show when={props.description}>
            <p class="text-sm leading-relaxed text-muted-foreground">{props.description}</p>
          </Show>
        </div>
        <Show when={props.aside}>{props.aside}</Show>
      </div>
      {props.children}
    </section>
  );
}
