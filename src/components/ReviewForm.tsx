import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Star, Trash2, X } from "lucide-solid";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { TextArea } from "~/ui/textarea";
import { Label } from "~/ui/label";
import {
  CONTENT_MAX,
  CONTENT_MIN,
  TITLE_MAX,
  formIssueMessage,
  formIssues,
  ratingLabel,
} from "~/lib/reviews/model";
import type { ReviewWrite } from "~/lib/api/reviews";

export interface ReviewFormProps {
  poiName?: string;
  /**
   * The values the form starts from. Read once, when the form mounts: the
   * caller mounts it per opening (inside a Show), so a switch from writing to
   * editing after AlreadyExists keeps what was typed.
   */
  initial?: ReviewWrite;
  /** Editing your existing review: the title says so and the button says Save. */
  isEdit?: boolean;
  /** A line above the buttons that is not an error, e.g. "You already reviewed this place". */
  notice?: string | null;
  /** Set while the write is in flight; the form waits on the caller for it. */
  isSubmitting?: boolean;
  /** A failed write, shown inside the form so the sheet stays open. */
  error?: string | null;
  onSubmit: (values: ReviewWrite) => void;
  onCancel: () => void;
  /** Editing only: delete the review from the sheet. */
  onDelete?: () => void;
}

/**
 * Write or edit a review: a whole-star rating, an optional title of up to 100
 * characters, 10 to 1000 characters of text, and when you visited. No travel
 * type and no photos: the server has no field for the first and no upload for
 * the second. Post stays disabled until the form is valid.
 */
export default function ReviewForm(props: ReviewFormProps) {
  const [rating, setRating] = createSignal(props.initial?.rating ?? 0);
  const [hoverRating, setHoverRating] = createSignal(0);
  const [title, setTitle] = createSignal(props.initial?.title ?? "");
  const [content, setContent] = createSignal(props.initial?.content ?? "");
  const [visitDate, setVisitDate] = createSignal(props.initial?.visitDate ?? "");
  const [touched, setTouched] = createSignal(false);

  const issues = createMemo(() =>
    formIssues({ rating: rating(), title: title(), content: content() }),
  );
  const firstIssue = () =>
    touched() && issues().length > 0 ? formIssueMessage(issues()[0]) : null;
  const isEdit = () => Boolean(props.isEdit);
  const canSend = () => issues().length === 0 && !props.isSubmitting;

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !props.isSubmitting) props.onCancel();
    };
    document.addEventListener("keydown", onKey);
    onCleanup(() => document.removeEventListener("keydown", onKey));
  });

  const submit = (e: Event) => {
    e.preventDefault();
    setTouched(true);
    if (issues().length > 0 || props.isSubmitting) return;
    props.onSubmit({
      rating: rating(),
      title: title(),
      content: content(),
      visitDate: visitDate(),
    });
  };

  const stars = () =>
    Array.from({ length: 5 }, (_, i) => {
      const value = i + 1;
      const filled = value <= (hoverRating() || rating());
      return (
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={`${value} star${value === 1 ? "" : "s"}`}
          onClick={() => setRating(value)}
          onMouseEnter={() => setHoverRating(value)}
          onMouseLeave={() => setHoverRating(0)}
          class={filled ? "text-yellow-500" : "text-muted-foreground"}
        >
          <Star class={`w-8 h-8 ${filled ? "fill-current" : ""}`} />
        </Button>
      );
    });

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-form-title"
    >
      <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
        <div class="flex items-start justify-between border-b border-border p-6">
          <div>
            <h2 id="review-form-title" class="text-xl font-semibold text-foreground">
              {isEdit() ? "Edit your review" : "Write a review"}
            </h2>
            <Show when={props.poiName}>
              <p class="mt-1 text-sm text-muted-foreground">for {props.poiName}</p>
            </Show>
          </div>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Close"
            onClick={props.onCancel}
          >
            <X class="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={submit} class="space-y-6 p-6">
          <div>
            <Label class="mb-3 block">Overall rating *</Label>
            <div class="flex items-center gap-2">
              <div class="flex rounded-lg p-1">{stars()}</div>
              <Show when={(hoverRating() || rating()) > 0}>
                <span class="ml-2 text-lg font-medium text-foreground">
                  {ratingLabel(hoverRating() || rating())}
                </span>
              </Show>
            </div>
          </div>

          <TextFieldRoot>
            <Label class="mb-2 block">Title</Label>
            <TextField
              type="text"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value.slice(0, TITLE_MAX))}
              placeholder="Summarise your experience"
              maxLength={TITLE_MAX}
            />
            <p class="mt-1 text-xs text-muted-foreground">
              {title().length}/{TITLE_MAX}
            </p>
          </TextFieldRoot>

          <TextFieldRoot>
            <Label class="mb-2 block">Your review *</Label>
            <TextArea
              value={content()}
              onInput={(e) => setContent(e.currentTarget.value.slice(0, CONTENT_MAX))}
              onBlur={() => setTouched(true)}
              placeholder="What was it like, what would you tell a friend?"
              class="min-h-[120px]"
              maxLength={CONTENT_MAX}
            />
            <p class="mt-1 text-xs text-muted-foreground">
              {content().trim().length}/{CONTENT_MAX}
              <Show when={content().trim().length < CONTENT_MIN}> · at least {CONTENT_MIN}</Show>
            </p>
          </TextFieldRoot>

          <TextFieldRoot>
            <Label class="mb-2 block">When did you visit?</Label>
            <TextField
              type="date"
              value={visitDate()}
              onInput={(e) => setVisitDate(e.currentTarget.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </TextFieldRoot>

          <Show when={props.notice}>
            <p role="status" class="text-sm text-muted-foreground">
              {props.notice}
            </p>
          </Show>

          <Show when={firstIssue() ?? props.error}>
            <p role="alert" class="text-sm text-destructive">
              {firstIssue() ?? props.error}
            </p>
          </Show>

          <div class="flex items-center justify-between border-t border-border pt-4">
            <Show
              when={isEdit() && props.onDelete}
              fallback={<p class="text-xs text-muted-foreground">Your review is public.</p>}
            >
              <Button
                variant="ghost"
                type="button"
                class="text-destructive hover:bg-destructive/10"
                onClick={() => props.onDelete?.()}
                disabled={props.isSubmitting}
              >
                <Trash2 class="mr-1 h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            </Show>
            <div class="flex items-center gap-3">
              <Button
                variant="secondary"
                type="button"
                onClick={props.onCancel}
                disabled={props.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSend()}>
                {props.isSubmitting ? "Saving…" : isEdit() ? "Save" : "Post review"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
