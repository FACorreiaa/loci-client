import { createSignal, For, Show } from "solid-js";
import { Calendar, Pencil, Star, ThumbsUp, Trash2 } from "lucide-solid";
import type { ReviewItem } from "~/lib/api/reviews";
import { foldText, needsFold, ratingLabel } from "~/lib/reviews/model";

export interface ReviewCardProps {
  review: ReviewItem;
  /** The place's name above the text, for lists that mix places (My reviews). */
  showPlace?: boolean;
  /** This browser has marked it helpful. */
  voted?: boolean;
  /** The signed-in user wrote it: Edit and Delete instead of Helpful. */
  mine?: boolean;
  onHelpful?: (review: ReviewItem) => void;
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

  return (
    <article class="rounded-2xl border border-border bg-card p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <Show when={props.showPlace && r().poiName}>
            <p class="truncate text-sm font-medium text-foreground">{r().poiName}</p>
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
            {props.mine ? "You" : r().reviewerName || "A traveller"}
            <Show when={r().verified}> · Verified</Show>
            <Show when={r().visitDate}>
              <span class="ml-2 inline-flex items-center gap-1">
                <Calendar class="h-3 w-3" aria-hidden="true" />
                Visited {formatDate(r().visitDate)}
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
            <button
              type="button"
              onClick={() => props.onHelpful?.(r())}
              aria-pressed={props.voted ?? false}
              class={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm transition-colors ${
                props.voted ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <ThumbsUp class="h-4 w-4" aria-hidden="true" />
              Helpful
              <Show when={r().helpful > 0}>
                <span class="text-xs">({r().helpful})</span>
              </Show>
            </button>
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
    </article>
  );
}
