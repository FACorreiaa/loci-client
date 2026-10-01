import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { AlertCircle, Clock, ShieldCheck } from "lucide-solid";
import { ErrorView } from "~/components/ErrorView";
import type { MyClaim } from "~/lib/contribute/my-claims";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * "My reports" — the scout's own claims and what became of each. A report
 * does not go live on its own, so the row's job is to say which ones are still
 * waiting on a second scout and which made it onto the guide.
 */
export function MyClaimsList(props: {
  claims: MyClaim[];
  total: number;
  loading: boolean;
  error?: unknown;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
}) {
  return (
    <>
      <Show when={props.loading}>
        <div class="grid gap-2" aria-busy="true" aria-label="Loading your reports">
          <div class="h-20 animate-pulse rounded-xl bg-muted" />
          <div class="h-20 animate-pulse rounded-xl bg-muted" />
        </div>
      </Show>

      <Show when={!props.loading && props.error !== undefined && props.claims.length === 0}>
        <ErrorView error={props.error} onRetry={props.onRetry} />
      </Show>

      <Show when={!props.loading && props.error === undefined && props.claims.length === 0}>
        <div class="rounded-xl border border-dashed border-border p-6 text-center">
          <p class="text-sm font-semibold">No reports yet</p>
          <p class="mt-1 text-xs text-muted-foreground">
            Pick a place below and tell us what you saw. Your reports, and whether a second scout
            backed them up, will show here.
          </p>
        </div>
      </Show>

      <Show when={props.claims.length > 0}>
        <ul class="grid gap-2">
          <For each={props.claims}>{(claim) => <ClaimRow claim={claim} />}</For>
        </ul>

        <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p class="font-coord text-[11px] uppercase tracking-wider text-muted-foreground">
            {props.claims.length} of {Math.max(props.total, props.claims.length)} reports
          </p>
          <Show when={props.hasMore}>
            <button
              type="button"
              class="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-transform hover:border-accent disabled:cursor-not-allowed disabled:opacity-40 motion-press"
              disabled={props.loadingMore}
              onClick={() => props.onLoadMore()}
            >
              {props.loadingMore ? "Loading…" : "Load more"}
            </button>
          </Show>
        </div>

        <Show when={props.error !== undefined && !props.loadingMore}>
          <p class="mt-2 text-xs text-destructive" role="alert">
            Could not load more reports.{" "}
            <button
              type="button"
              class="font-semibold underline underline-offset-2"
              onClick={() => props.onLoadMore()}
            >
              Try again
            </button>
          </p>
        </Show>
      </Show>
    </>
  );
}

function ClaimRow(props: { claim: MyClaim }) {
  return (
    <li class="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <StatusIcon claim={props.claim} />
      <div class="min-w-0 flex-1">
        <Show
          when={props.claim.placeExists}
          fallback={
            <p class="truncate font-semibold text-muted-foreground">{props.claim.placeName}</p>
          }
        >
          <A
            href={`/places/${encodeURIComponent(props.claim.poiId)}`}
            class="block truncate font-semibold underline-offset-4 hover:text-accent hover:underline"
          >
            {props.claim.placeName}
          </A>
        </Show>
        <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {props.claim.fieldLabel} · {props.claim.valueText}
        </p>
        <p class="mt-1 font-coord text-[9px] uppercase tracking-wider text-muted-foreground">
          {props.claim.statusText}
          <Show when={props.claim.createdAt}>
            {(date) => (
              <>
                {" · "}
                <time datetime={date().toISOString()}>{dateFormat.format(date())}</time>
              </>
            )}
          </Show>
        </p>
      </div>
    </li>
  );
}

function StatusIcon(props: { claim: MyClaim }) {
  const cls = "mt-0.5 h-5 w-5 shrink-0";
  if (props.claim.status === "ACCEPTED") return <ShieldCheck class={`${cls} text-primary`} />;
  if (props.claim.status === "CONTRADICTED") return <AlertCircle class={`${cls} text-accent`} />;
  return <Clock class={`${cls} text-muted-foreground`} />;
}
