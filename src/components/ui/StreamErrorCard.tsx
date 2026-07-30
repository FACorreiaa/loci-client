import { Show } from "solid-js";
import { AlertCircle, RefreshCw, Sparkles } from "lucide-solid";
import { A } from "@solidjs/router";
import { parseStreamError } from "~/lib/errors";

interface StreamErrorCardProps {
  /** The user-facing error string already on the hook's state. */
  error: string;
  /** Headline. Defaults to a generic one; pass a page-specific line. */
  title?: string;
  /** Called when the user asks to try again. Omit to hide the retry button. */
  onRetry?: () => void;
}

/**
 * The recoverable failure card for streamed AI results.
 *
 * Every stream-driven page needs this: when a stream dies the page must say so
 * and offer a way forward, never sit on a spinner or drop the user on a blank
 * route. Quota exhaustion is called out separately because retrying it is
 * pointless — the counter resets at midnight UTC, so we route to pricing.
 */
export function StreamErrorCard(props: StreamErrorCardProps) {
  const parsed = () => parseStreamError(props.error);
  const isQuota = () => parsed().type === "quota_exhausted";

  return (
    <div
      role="alert"
      class="mb-6 p-4 rounded-xl border flex items-start gap-3"
      classList={{
        "bg-accent/10 border-accent/20 text-accent": isQuota(),
        "bg-destructive/10 border-destructive/20 text-destructive": !isQuota(),
      }}
    >
      <Show when={isQuota()} fallback={<AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />}>
        <Sparkles class="w-5 h-5 flex-shrink-0 mt-0.5" />
      </Show>

      <div class="min-w-0">
        <p class="font-bold">
          {isQuota() ? "Daily limit reached" : (props.title ?? "Something went wrong")}
        </p>
        <p class="text-sm opacity-90">{parsed().userMessage}</p>

        <div class="mt-3 flex flex-wrap items-center gap-3">
          <Show when={isQuota()}>
            <A
              href="/pricing"
              class="text-sm font-medium underline underline-offset-2 hover:no-underline"
            >
              See Pro plans
            </A>
          </Show>

          <Show when={props.onRetry && parsed().canRetry}>
            <button
              type="button"
              onClick={() => props.onRetry?.()}
              class="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2 hover:no-underline"
            >
              <RefreshCw class="w-3.5 h-3.5" />
              Try again
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}

export default StreamErrorCard;
