import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Calendar, Flag, Pencil, Star, ThumbsUp, Trash2 } from "lucide-solid";
import type { ReviewItem } from "~/lib/api/reviews";
import {
  REPORT_REASONS,
  foldText,
  needsFold,
  ratingLabel,
  visitLabel,
  type ReportReason,
} from "~/lib/reviews/model";

export interface ReviewCardProps {
  review: ReviewItem;
  /** The place's name above the text, for lists that mix places (My reviews). */
  showPlace?: boolean;
  /** Where the place's name links to (My reviews → the place). */
  placeHref?: string;
  /** You marked it helpful (the server's voted_by_me, or your tap since). */
  voted?: boolean;
  /** A vote is in flight; the button ignores taps until it settles. */
  votePending?: boolean;
  /** The signed-in user wrote it: Edit and Delete instead of Helpful and Report. */
  mine?: boolean;
  /** Signed in: Helpful and Report are offered (never on your own review). */
  canInteract?: boolean;
  onHelpful?: (review: ReviewItem) => void;
  /** Resolves when the report was taken; rejects with a message to show. */
  onReport?: (review: ReviewItem, reason: ReportReason) => Promise<void>;
  onEdit?: (review: ReviewItem) => void;
  onDelete?: (review: ReviewItem) => void;
}

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })
    : "";

/** One review: stars and label, the reviewer, the text folded at 200 characters, and one action row. */
export default function ReviewCard(props: ReviewCardProps) {
  const [expanded, setExpanded] = createSignal(false);
  const r = () => props.review;
  const text = () => (expanded() || !needsFold(r().content) ? r().content : foldText(r().content));
  const [reporting, setReporting] = createSignal(false);
  const [reason, setReason] = createSignal<ReportReason>("spam");
  const [reportState, setReportState] = createSignal<"idle" | "sending" | "sent">("idle");
  const [reportError, setReportError] = createSignal<string | null>(null);

  const sendReport = async () => {
    if (!props.onReport || reportState() === "sending") return;
    setReportState("sending");
    setReportError(null);
    try {
      await props.onReport(r(), reason());
      setReportState("sent");
      setReporting(false);
    } catch (e) {
      setReportState("idle");
      setReportError(e instanceof Error ? e.message : "We couldn't send the report.");
    }
  };

  return (
    <article class="rounded-2xl border border-border bg-card p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <Show when={props.showPlace}>
            <Show
              when={props.placeHref}
              fallback={
                <p class="truncate text-sm font-medium text-foreground">
                  {r().poiName || "A place"}
                </p>
              }
            >
              <A
                href={props.placeHref!}
                class="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
              >
                {r().poiName || "Open the place"}
              </A>
            </Show>
          </Show>
          <div class="mt-1 flex items-center gap-2">
            <span class="flex" aria-label={`${r().rating} out of 5`}>
              <For each={[1, 2, 3, 4, 5]}>
                {(i) => (
                  <Star
                    class={`h-4 w-4 ${i <= r().rating ? "fill-current text-yellow-500" : "text-muted-foreground/40"}`}
                    aria-hidden="true"
                  />
                )}
              </For>
            </span>
            <span class="text-xs font-medium text-muted-foreground">{ratingLabel(r().rating)}</span>
            <span class="text-xs text-muted-foreground">· {formatDate(r().createdAt)}</span>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            {props.mine ? "Your review" : r().reviewerName || "A traveller"}
            <Show when={r().verified}> · Verified</Show>
            <Show when={r().visitDate}>
              <span class="ml-2 inline-flex items-center gap-1">
                <Calendar class="h-3 w-3" aria-hidden="true" />
                {visitLabel(r().visitDate)}
              </span>
            </Show>
          </p>
        </div>
      </div>

      <Show when={r().title}>
        <h3 class="mt-3 font-semibold text-foreground">{r().title}</h3>
      </Show>
      <p class="mt-2 whitespace-pre-line leading-relaxed text-foreground/90">{text()}</p>
      <Show when={needsFold(r().content) && !expanded()}>
        <button
          type="button"
          class="mt-1 text-sm font-medium text-primary hover:underline"
          onClick={() => setExpanded(true)}
        >
          Read more
        </button>
      </Show>

      <div class="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <Show
          when={props.mine}
          fallback={
            <>
              <Show
                when={props.canInteract}
                fallback={
                  <Show when={r().helpful > 0}>
                    <span class="text-xs text-muted-foreground">
                      {r().helpful} found this helpful
                    </span>
                  </Show>
                }
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!props.votePending) props.onHelpful?.(r());
                  }}
                  aria-pressed={props.voted ?? false}
                  aria-busy={props.votePending ?? false}
                  class={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm transition-colors ${
                    props.voted
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <ThumbsUp
                    class={`h-4 w-4 ${props.voted ? "fill-current" : ""}`}
                    aria-hidden="true"
                  />
                  Helpful
                  <Show when={r().helpful > 0}>
                    <span class="text-xs tabular-nums">({r().helpful})</span>
                  </Show>
                </button>
                <Show when={props.onReport}>
                  <Show
                    when={reportState() !== "sent"}
                    fallback={
                      <span class="ml-auto text-xs text-muted-foreground" role="status">
                        Reported. Thanks for telling us.
                      </span>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setReporting(!reporting())}
                      aria-expanded={reporting()}
                      class="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm text-muted-foreground hover:bg-accent"
                    >
                      <Flag class="h-4 w-4" aria-hidden="true" />
                      Report
                    </button>
                  </Show>
                </Show>
              </Show>
            </>
          }
        >
          <button
            type="button"
            onClick={() => props.onEdit?.(r())}
            class="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm text-muted-foreground hover:bg-accent"
          >
            <Pencil class="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => props.onDelete?.(r())}
            class="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 class="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
          <Show when={r().helpful > 0}>
            <span class="ml-auto text-xs text-muted-foreground">
              {r().helpful} found this helpful
            </span>
          </Show>
        </Show>
      </div>

      <Show when={reporting()}>
        <div class="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-3">
          <label class="text-sm text-foreground" for={`report-${r().id}`}>
            Why are you reporting this review?
          </label>
          <select
            id={`report-${r().id}`}
            class="rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground"
            value={reason()}
            onChange={(e) => setReason(e.currentTarget.value as ReportReason)}
          >
            <For each={REPORT_REASONS}>
              {(option) => <option value={option.value}>{option.label}</option>}
            </For>
          </select>
          <div class="ml-auto flex gap-2">
            <button
              type="button"
              class="rounded-lg px-3 py-1 text-sm text-muted-foreground hover:bg-accent"
              onClick={() => {
                setReporting(false);
                setReportError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-lg bg-destructive px-3 py-1 text-sm text-destructive-foreground disabled:opacity-50"
              disabled={reportState() === "sending"}
              onClick={() => void sendReport()}
            >
              {reportState() === "sending" ? "Sending…" : "Send report"}
            </button>
          </div>
          <Show when={reportError()}>
            <p role="alert" class="w-full text-sm text-destructive">
              {reportError()}
            </p>
          </Show>
        </div>
      </Show>
    </article>
  );
}
