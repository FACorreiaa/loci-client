import { Show, type JSX } from "solid-js";
import { Mascot, type MascotState } from "~/components/brand/Mascot";

type EmptyStateProps = {
  title: string;
  body?: JSX.Element;
  /** A button or link; the one thing to do next. */
  action?: JSX.Element;
  mascot?: MascotState;
  class?: string;
};

/**
 * One place for "nothing here yet", "you're offline" and "that went wrong".
 * The mascot is decorative — the title says what happened — so screen readers
 * hear the sentence, not a description of the figure.
 */
export function EmptyState(props: EmptyStateProps): JSX.Element {
  return (
    <div
      class={`mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center ${props.class ?? ""}`}
    >
      <Mascot state={props.mascot ?? "empty"} width={112} decorative idle class="mb-6" />
      <h2 class="font-display text-xl font-semibold tracking-tight text-foreground">
        {props.title}
      </h2>
      <Show when={props.body}>
        <p class="mt-2 text-sm leading-6 text-muted-foreground">{props.body}</p>
      </Show>
      <Show when={props.action}>
        <div class="mt-6">{props.action}</div>
      </Show>
    </div>
  );
}
