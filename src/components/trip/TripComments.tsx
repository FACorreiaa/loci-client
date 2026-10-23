import { createSignal, For, Show } from "solid-js";
import { useQueryClient } from "@tanstack/solid-query";
import { Button } from "~/ui/button";
import UserAvatar from "~/components/social/UserAvatar";
import { timeAgo } from "~/lib/news/ticker";
import { useBlockUser } from "~/lib/api/social";
import {
  commentErrorMessage,
  commentKeys,
  MAX_COMMENT_LENGTH,
  useAddTripComment,
  useDeleteTripComment,
  useReportTripComment,
  type CommentReportReason,
  type TripComment,
} from "~/lib/api/trip-comments";

export interface TripCommentsProps {
  tripId: string;
  comments: TripComment[];
  /** The trip's stops, for "about" and for naming what a comment is on. */
  stops: { id: string; name: string }[];
  /** The stop the composer is about, when the page picked one. */
  aboutStopId?: string;
  onAboutChange?: (stopId: string | undefined) => void;
}

const REASONS: { value: CommentReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "offensive", label: "Offensive" },
  { value: "other", label: "Something else" },
];

/**
 * Notes between the people planning a trip: about the trip, or about one of
 * its stops. Everyone on the trip writes and reads them.
 */
export default function TripComments(props: TripCommentsProps) {
  const add = useAddTripComment();
  const [body, setBody] = createSignal("");
  const [ownAbout, setOwnAbout] = createSignal<string | undefined>();
  const [error, setError] = createSignal<string | null>(null);
  const about = () => (props.onAboutChange ? props.aboutStopId : ownAbout());
  const setAbout = (id: string | undefined) =>
    props.onAboutChange ? props.onAboutChange(id) : setOwnAbout(id);
  const stopName = (id?: string) => (id ? props.stops.find((s) => s.id === id)?.name : undefined);
  const text = () => body().trim();

  const post = (e: Event) => {
    e.preventDefault();
    if (!text() || add.isPending) return;
    setError(null);
    add.mutate(
      { tripId: props.tripId, body: text(), stopId: stopName(about()) ? about() : undefined },
      {
        onSuccess: () => {
          setBody("");
          setAbout(undefined);
        },
        onError: (err) => setError(commentErrorMessage(err)),
      },
    );
  };

  return (
    <section class="loci-card no-print mb-6 p-4" aria-labelledby="trip-comments-title">
      <h2
        id="trip-comments-title"
        class="font-coord mb-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
      >
        Comments · {props.comments.length}
      </h2>

      <Show
        when={props.comments.length > 0}
        fallback={
          <p class="mb-3 text-sm text-muted-foreground">
            Nothing yet. Leave a note for everyone on the trip.
          </p>
        }
      >
        <ul class="mb-4 space-y-3">
          <For each={props.comments}>
            {(c) => <CommentRow tripId={props.tripId} comment={c} stopName={stopName(c.stopId)} />}
          </For>
        </ul>
      </Show>

      <form onSubmit={post} class="space-y-2" data-testid="trip-comment-form">
        <Show when={props.stops.length > 0}>
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            About
            <select
              class="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={about() ?? ""}
              onChange={(e) => setAbout(e.currentTarget.value || undefined)}
              data-testid="trip-comment-about"
            >
              <option value="">The whole trip</option>
              <For each={props.stops}>{(s) => <option value={s.id}>{s.name}</option>}</For>
            </select>
          </label>
        </Show>
        <textarea
          class="min-h-[72px] w-full rounded-md border border-border bg-background p-2 text-sm"
          placeholder={
            stopName(about()) ? `Something about ${stopName(about())}…` : "Write a comment…"
          }
          maxLength={MAX_COMMENT_LENGTH}
          value={body()}
          onInput={(e) => setBody(e.currentTarget.value)}
          aria-label="Comment"
          data-testid="trip-comment-body"
        />
        <Show when={error()}>
          <p role="alert" class="text-[13px] text-destructive">
            {error()}
          </p>
        </Show>
        <div class="flex justify-end">
          <Button type="submit" size="sm" disabled={!text() || add.isPending}>
            {add.isPending ? "Posting…" : "Post"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function CommentRow(props: { tripId: string; comment: TripComment; stopName?: string }) {
  const qc = useQueryClient();
  const del = useDeleteTripComment();
  const report = useReportTripComment();
  const block = useBlockUser();
  const [mode, setMode] = createSignal<"idle" | "report" | "block">("idle");
  const [error, setError] = createSignal<string | null>(null);
  const c = () => props.comment;
  const name = () => c().author?.displayName || c().author?.username || "Someone";
  const busy = () => del.isPending || report.isPending || block.isPending;

  const doDelete = () =>
    del.mutate(
      { tripId: props.tripId, commentId: c().id },
      { onError: (err) => setError(commentErrorMessage(err)) },
    );
  const doReport = (reason: CommentReportReason) =>
    report.mutate(
      { tripId: props.tripId, commentId: c().id, reason },
      { onError: (err) => setError(commentErrorMessage(err)) },
    );
  const doBlock = () => {
    const id = c().author?.id;
    if (!id) return;
    block.mutate(id, {
      onSuccess: () => void qc.invalidateQueries({ queryKey: commentKeys.forTrip(props.tripId) }),
      onError: () => setError(`Couldn't block ${name()}. Try again.`),
    });
  };

  const linkClass =
    "text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-60";

  return (
    <li class="flex gap-3" data-testid="trip-comment">
      <Show when={c().author}>{(u) => <UserAvatar user={u()} size="sm" />}</Show>
      <div class="min-w-0 flex-1">
        <p class="text-xs text-muted-foreground">
          <span class="font-medium text-foreground">{c().mine ? "You" : name()}</span>
          <Show when={props.stopName}> · on {props.stopName}</Show>
          <Show when={c().createdAt}> · {timeAgo(c().createdAt!, new Date())}</Show>
        </p>
        <p class="whitespace-pre-wrap break-words text-sm leading-snug">{c().body}</p>

        <Show when={error()}>
          <p role="alert" class="mt-1 text-[13px] text-destructive">
            {error()}
          </p>
        </Show>

        <Show when={mode() === "report"}>
          <div class="mt-2 flex flex-wrap items-center gap-2" data-testid="trip-comment-reasons">
            <span class="text-xs text-muted-foreground">Report as</span>
            <For each={REASONS}>
              {(r) => (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy()}
                  onClick={() => doReport(r.value)}
                >
                  {r.label}
                </Button>
              )}
            </For>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </Show>
        <Show when={mode() === "block"}>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <span class="text-xs text-muted-foreground">
              Block {name()}? You won't see each other's comments or profiles.
            </span>
            <Button size="sm" variant="destructive" disabled={busy()} onClick={doBlock}>
              Block
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </Show>

        <Show when={mode() === "idle"}>
          <div class="mt-1 flex gap-3">
            <Show when={c().canDelete}>
              <button type="button" class={linkClass} disabled={busy()} onClick={doDelete}>
                Delete
              </button>
            </Show>
            <Show when={!c().mine}>
              <button type="button" class={linkClass} onClick={() => setMode("report")}>
                Report
              </button>
              <Show when={c().author}>
                <button type="button" class={linkClass} onClick={() => setMode("block")}>
                  Block
                </button>
              </Show>
            </Show>
          </div>
        </Show>
      </div>
    </li>
  );
}
