import { createSignal, onCleanup, Show } from "solid-js";
import { Check, Copy } from "lucide-solid";
import { cn } from "~/lib/utils";
import { copyText } from "~/lib/clipboard";

/**
 * A copy button that confirms itself for two seconds.
 *
 * Shared by the block and inline forms below. The confirmation is a swap of
 * the icon and the accessible name, not a toast: it sits where the eye already
 * is, and copying five snippets in a row should not stack five toasts.
 */
function CopyButton(props: { value: string; what?: string; class?: string }) {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const copy = async () => {
    const ok = await copyText(props.value);
    if (!ok) return;
    setCopied(true);
    clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), 2000);
  };

  const label = () => (copied() ? "Copied" : `Copy ${props.what ?? "to clipboard"}`);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label()}
      title={label()}
      class={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 font-coord text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        props.class,
      )}
    >
      <Show when={copied()} fallback={<Copy class="h-3.5 w-3.5" aria-hidden="true" />}>
        <Check class="h-3.5 w-3.5 text-accent" aria-hidden="true" />
      </Show>
      <span aria-hidden="true">{copied() ? "Copied" : "Copy"}</span>
    </button>
  );
}

export interface CodeBlockProps {
  /** What the snippet is: "Command", "~/.codex/config.toml", … Shown in mono caps. */
  heading: string;
  /** Syntax name, exposed as `data-language` on the <pre> for styling or highlighting. */
  lang?: string;
  body: string;
  class?: string;
}

/**
 * A snippet with a heading and a copy button.
 *
 * Setup is copied, not read: an agent config is punctuation-exact and
 * retyping it from the screen is how a bad quote or a lost backslash becomes
 * "MCP doesn't work". The body wraps rather than scrolling sideways, because
 * a long bearer token in a scrolled-off column is exactly the part somebody
 * fails to notice when checking what they pasted.
 */
export function CodeBlock(props: CodeBlockProps) {
  return (
    <div class={cn("min-w-0", props.class)}>
      <div class="mb-1.5 flex items-center justify-between gap-2">
        <span class="min-w-0 truncate font-coord text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {props.heading}
        </span>
        <CopyButton value={props.body} what={props.heading} />
      </div>
      <pre
        data-language={props.lang}
        class="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground"
      >
        <code>{props.body}</code>
      </pre>
    </div>
  );
}

/**
 * A single value — a URL, an endpoint — in mono with a copy button beside it.
 * Truncates rather than wraps: the point is to copy it, not to read it.
 */
export function InlineCopy(props: { value: string; class?: string; what?: string }) {
  return (
    <div
      class={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 py-1.5 pl-3 pr-1.5",
        props.class,
      )}
    >
      <code class="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={props.value}>
        {props.value}
      </code>
      <CopyButton value={props.value} what={props.what} />
    </div>
  );
}
