import { createEffect, createSignal, For, Show, type JSX } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { Code, ConnectError } from "@connectrpc/connect";
import { Button } from "~/ui/button";
import { useBoardsSession } from "~/components/boards/session";
import { timeAgo } from "~/lib/news/ticker";
import {
  useReportedTripComments,
  useResolveTripCommentReport,
  type ModerationAction,
} from "~/lib/api/trip-comments";
import { useReportedReviews, useResolveReviewReport } from "~/lib/api/reviews";
import { reviewErrorMessage } from "~/lib/reviews/wire";
import { showToast } from "~/lib/toast-store";
import { cn } from "~/lib/utils";

type Tab = "comments" | "reviews";

/** One reported item, whichever list it came from. */
interface ReportRowModel {
  id: string;
  body: string;
  /** What it is on: a place, a trip. */
  context?: string;
  author: string;
  reportCount: number;
  reasons: { reason: string; count: number }[];
  details: string[];
  hidden: boolean;
  lastReportedAt?: string;
}

const listErrorMessage = (err: unknown): string => {
  if (err instanceof ConnectError) {
    if (err.code === Code.PermissionDenied) return "Only admins can see reported content.";
    if (err.code === Code.Unauthenticated) return "Sign in again to continue.";
    if (err.rawMessage) return err.rawMessage;
  }
  return "Couldn't load reports. Try again.";
};

const commentResolveError = (err: unknown): string => {
  if (err instanceof ConnectError) {
    if (err.code === Code.PermissionDenied) return "Only admins can resolve reports.";
    if (err.code === Code.NotFound) return "That comment is no longer here.";
    if (err.rawMessage) return err.rawMessage;
  }
  return "Couldn't resolve that report. Try again.";
};

/**
 * Admin: reported trip comments and reviews, with Keep (close the reports)
 * and Remove (take it down for everyone). Gated on the boards viewer's
 * is_admin; the server refuses non-admins either way.
 */
export default function AdminReportsPage() {
  const session = useBoardsSession();
  const [tab, setTab] = createSignal<Tab>("comments");

  const tabClass = (t: Tab) =>
    cn(
      "-mb-px border-b-2 px-3 py-2 text-sm",
      tab() === t
        ? "border-foreground font-medium text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Title>Reports · Admin · Loci</Title>
      <Meta name="robots" content="noindex" />
      <A href="/boards/admin" class="text-sm text-muted-foreground hover:text-foreground">
        ← Moderation
      </A>
      <h1 class="mt-2 text-3xl">Reports</h1>

      <Show
        when={session.isAdmin()}
        fallback={<p class="mt-6 text-muted-foreground">This page is not available.</p>}
      >
        <p class="mt-1 text-muted-foreground">
          Keep closes the open reports. Remove takes it down for everyone.
        </p>
        <div class="mt-4 flex gap-2 border-b border-border" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab() === "comments"}
            class={tabClass("comments")}
            onClick={() => setTab("comments")}
          >
            Trip comments
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab() === "reviews"}
            class={tabClass("reviews")}
            onClick={() => setTab("reviews")}
          >
            Reviews
          </button>
        </div>
        <Show when={tab() === "comments"} fallback={<ReviewReports />}>
          <CommentReports />
        </Show>
      </Show>
    </main>
  );
}

function CommentReports() {
  const [page, setPage] = createSignal(1);
  const query = useReportedTripComments(page, () => true);
  const resolve = useResolveTripCommentReport();
  // Guarded read: touching .data while pending suspends the whole route.
  const data = () => (query.isSuccess ? query.data : undefined);
  const rows = (): ReportRowModel[] =>
    (data()?.comments ?? []).flatMap((r) =>
      r.comment
        ? [
            {
              id: r.comment.id,
              body: r.comment.body,
              context: `Trip ${r.comment.tripId}`,
              author:
                r.comment.author?.displayName ||
                r.comment.author?.username ||
                r.comment.author?.id ||
                "Unknown",
              reportCount: r.reportCount,
              reasons: r.reasons,
              details: r.details,
              hidden: r.hidden,
              lastReportedAt: r.lastReportedAt,
            },
          ]
        : [],
    );
  // Resolving the last row on a later page leaves it empty: step back.
  createEffect(() => {
    if (query.isSuccess && page() > 1 && (data()?.comments.length ?? 0) === 0) {
      setPage(page() - 1);
    }
  });

  return (
    <ReportList
      rows={rows()}
      loading={query.isLoading}
      error={query.isError ? listErrorMessage(query.error) : undefined}
      empty="No reported trip comments."
      page={page()}
      hasMore={data()?.hasMore ?? false}
      onPage={setPage}
      pending={resolve.isPending}
      onResolve={(id, action) =>
        resolve.mutate(
          { commentId: id, action },
          {
            onError: (err) => showToast({ id: "admin-resolve", title: commentResolveError(err) }),
          },
        )
      }
    />
  );
}

function ReviewReports() {
  const [page, setPage] = createSignal(1);
  const query = useReportedReviews(page, () => true);
  const resolve = useResolveReviewReport();
  const data = () => (query.isSuccess ? query.data : undefined);
  const rows = (): ReportRowModel[] =>
    (data()?.reviews ?? []).flatMap((r) =>
      r.review
        ? [
            {
              id: r.review.id,
              body: [r.review.title, r.review.content].filter(Boolean).join("\n\n"),
              context: [`${r.review.rating}★`, r.review.poiName || r.review.poiId]
                .filter(Boolean)
                .join(" · "),
              author: r.review.reviewerName || r.review.userId || "Unknown",
              reportCount: r.reportCount,
              reasons: r.reasons,
              details: r.details,
              hidden: r.hidden,
              lastReportedAt: r.lastReportedAt,
            },
          ]
        : [],
    );
  createEffect(() => {
    if (query.isSuccess && page() > 1 && (data()?.reviews.length ?? 0) === 0) {
      setPage(page() - 1);
    }
  });

  return (
    <ReportList
      rows={rows()}
      loading={query.isLoading}
      error={query.isError ? listErrorMessage(query.error) : undefined}
      empty="No reported reviews."
      page={page()}
      hasMore={data()?.hasMore ?? false}
      total={data()?.total}
      onPage={setPage}
      pending={resolve.isPending}
      onResolve={(id, action) =>
        resolve.mutate(
          { reviewId: id, action },
          {
            onError: (err) =>
              showToast({
                id: "admin-resolve",
                title: reviewErrorMessage(err, "Couldn't resolve that report."),
              }),
          },
        )
      }
    />
  );
}

function ReportList(props: {
  rows: ReportRowModel[];
  loading: boolean;
  error?: string;
  empty: string;
  page: number;
  hasMore: boolean;
  total?: number;
  onPage: (page: number) => void;
  pending: boolean;
  onResolve: (id: string, action: ModerationAction) => void;
}): JSX.Element {
  return (
    <div class="mt-4">
      <Show when={props.error}>
        <p role="alert" class="text-sm text-destructive">
          {props.error}
        </p>
      </Show>
      <Show
        when={props.rows.length}
        fallback={
          <Show when={!props.error}>
            <p class="text-sm text-muted-foreground">{props.loading ? "Loading…" : props.empty}</p>
          </Show>
        }
      >
        <Show when={props.total}>
          <p class="mb-2 text-xs text-muted-foreground">{props.total} reported in all</p>
        </Show>
        <ul class="loci-card divide-y divide-border/60 p-0">
          <For each={props.rows}>
            {(row) => <ReportRow row={row} pending={props.pending} onResolve={props.onResolve} />}
          </For>
        </ul>
      </Show>
      <Show when={props.page > 1 || props.hasMore}>
        <div class="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={props.page <= 1 || props.loading}
            onClick={() => props.onPage(props.page - 1)}
          >
            Previous page
          </Button>
          <span class="text-xs text-muted-foreground">Page {props.page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!props.hasMore || props.loading}
            onClick={() => props.onPage(props.page + 1)}
          >
            Next page
          </Button>
        </div>
      </Show>
    </div>
  );
}

function ReportRow(props: {
  row: ReportRowModel;
  pending: boolean;
  onResolve: (id: string, action: ModerationAction) => void;
}) {
  const [confirming, setConfirming] = createSignal(false);
  const r = () => props.row;

  return (
    <li class="px-4 py-3" data-testid="admin-report-row">
      <p class="text-xs text-muted-foreground">
        <span class="font-medium text-foreground">{r().author}</span>
        <Show when={r().context}> · {r().context}</Show>
        <Show when={r().lastReportedAt}>
          {" "}
          · last reported {timeAgo(r().lastReportedAt!, new Date())}
        </Show>
      </p>
      <p class="mt-1 whitespace-pre-wrap break-words text-sm leading-snug">{r().body}</p>

      <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span class="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
          {r().reportCount} {r().reportCount === 1 ? "report" : "reports"}
        </span>
        <For each={r().reasons}>
          {(x) => (
            <span class="rounded-full bg-muted px-2 py-0.5">
              {x.reason} × {x.count}
            </span>
          )}
        </For>
        <Show when={r().hidden}>
          <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">
            hidden
          </span>
        </Show>
      </div>

      <Show when={r().details.length}>
        <ul class="mt-2 space-y-1 border-l-2 border-border pl-3 text-xs text-muted-foreground">
          <For each={r().details}>
            {(d) => <li class="whitespace-pre-wrap break-words">{d}</li>}
          </For>
        </ul>
      </Show>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <Show
          when={confirming()}
          fallback={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={props.pending}
                onClick={() => props.onResolve(r().id, "keep")}
              >
                Keep
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={props.pending}
                onClick={() => setConfirming(true)}
              >
                Remove
              </Button>
            </>
          }
        >
          <span class="text-xs text-muted-foreground">Remove it for everyone?</span>
          <Button
            variant="destructive"
            size="sm"
            disabled={props.pending}
            onClick={() => {
              setConfirming(false);
              props.onResolve(r().id, "remove");
            }}
          >
            Remove
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </Show>
      </div>
    </li>
  );
}
