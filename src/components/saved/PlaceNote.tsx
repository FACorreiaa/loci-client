import { createSignal, Show } from "solid-js";
import { useUpdateFavoriteNote } from "~/lib/api/favorites";
import type { SavedPlace } from "~/lib/saved/types";

const MIN = 40;

/**
 * The traveller's own note on a saved place, edited in place. A note of 40 or
 * more characters in their own words counts once toward the field score;
 * the hint says so plainly and the result says whether this one did.
 */
export default function PlaceNote(props: { place: SavedPlace }) {
  const update = useUpdateFavoriteNote();
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  const [result, setResult] = createSignal<string>("");

  const open = () => {
    setDraft(props.place.notes);
    setResult("");
    setEditing(true);
  };

  const save = () =>
    update.mutate(
      { itemId: props.place.itemId, contentType: props.place.contentType, notes: draft().trim() },
      {
        onSuccess: (res) => {
          setEditing(false);
          setResult(
            res.points > 0
              ? `Noted · +${res.points} field score`
              : res.counts || draft().trim().length < MIN
                ? ""
                : "Saved. It reads like the place's description, so it does not count.",
          );
        },
      },
    );

  return (
    <div class="mt-1.5">
      <Show
        when={editing()}
        fallback={
          <>
            <Show when={props.place.notes}>
              <p class="whitespace-pre-line text-sm text-foreground/80">{props.place.notes}</p>
            </Show>
            <button
              type="button"
              class="mt-0.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={open}
            >
              {props.place.notes ? "Edit note" : "Add a note"}
            </button>
            <Show when={result()}>
              <span class="ml-2 text-xs text-muted-foreground">{result()}</span>
            </Show>
          </>
        }
      >
        <textarea
          class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={3}
          maxLength={2000}
          value={draft()}
          aria-label={`Your note on ${props.place.title}`}
          placeholder="What you'd tell a friend: when to go, what to order, what to skip."
          onInput={(e) => setDraft(e.currentTarget.value)}
        />
        <div class="mt-1.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            disabled={update.isPending}
            onClick={save}
          >
            Save note
          </button>
          <button
            type="button"
            class="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <span class="text-xs text-muted-foreground">
            {draft().trim().length >= MIN
              ? "Notes in your own words count toward your field score."
              : `${MIN - draft().trim().length} more characters and it counts toward your field score.`}
          </span>
        </div>
        <Show when={update.isError}>
          <p class="mt-1 text-xs text-destructive">The note did not save. Try again.</p>
        </Show>
      </Show>
    </div>
  );
}
