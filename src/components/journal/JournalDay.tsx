import { For, Show } from "solid-js";
import { Check, ImagePlus, Loader2, X } from "lucide-solid";
import { VERDICTS } from "~/lib/ranking/flow";
import { PHOTO_TYPES } from "~/lib/journal/upload";
import type { JournalPhotoView } from "~/lib/journal/upload";
import { dayHeading, visitedCount, type JournalDayView } from "~/lib/journal/view";

const VERDICT_LABEL = new Map(VERDICTS.map((v) => [v.verdict, v.label]));

const time = (d?: Date) =>
  d ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";

export function PhotoStrip(props: { photos: JournalPhotoView[]; onDelete?: (id: string) => void }) {
  return (
    <Show when={props.photos.length > 0}>
      <ul class="mt-2 flex flex-wrap gap-2">
        <For each={props.photos}>
          {(photo) => (
            <li class="group relative">
              <a href={photo.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={photo.url}
                  alt={photo.caption || "Trip photo"}
                  loading="lazy"
                  class="h-24 w-24 rounded-xl object-cover sm:h-28 sm:w-28"
                />
              </a>
              <Show when={props.onDelete}>
                {(onDelete) => (
                  <button
                    type="button"
                    class="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow transition-opacity focus:opacity-100 group-hover:opacity-100"
                    aria-label="Remove this photo"
                    onClick={() => onDelete()(photo.id)}
                  >
                    <X class="h-3.5 w-3.5" />
                  </button>
                )}
              </Show>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}

export function AddPhotosButton(props: {
  label: string;
  busy: boolean;
  onFiles: (files: File[]) => void;
}) {
  let input: HTMLInputElement | undefined;
  return (
    <>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-60"
        disabled={props.busy}
        onClick={() => input?.click()}
      >
        <Show when={props.busy} fallback={<ImagePlus class="h-3.5 w-3.5" aria-hidden="true" />}>
          <Loader2 class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        </Show>
        {props.busy ? "Adding…" : props.label}
      </button>
      <input
        ref={input}
        type="file"
        class="hidden"
        multiple
        accept={PHOTO_TYPES.join(",")}
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = "";
          if (files.length > 0) props.onFiles(files);
        }}
      />
    </>
  );
}

export interface JournalDayProps {
  day: JournalDayView;
  /** The note as typed; kept by the page so a refetch cannot reset it. */
  draft: string;
  photosEnabled: boolean;
  uploading: boolean;
  onDraft: (text: string) => void;
  onSaveDiary: (text: string) => void;
  onAddPhotos: (files: File[], stopId?: string) => void;
  onDeletePhoto: (id: string) => void;
}

/** One day of the journal: the note, the plan as it went, and the photos. */
export default function JournalDay(props: JournalDayProps) {
  const counts = () => visitedCount(props.day);

  const save = () => {
    const text = props.draft.trim();
    if (text !== props.day.diary.trim()) props.onSaveDiary(text);
  };

  return (
    <section class="loci-card rounded-3xl p-5 sm:p-6" aria-label={dayHeading(props.day)}>
      <header class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-lg font-semibold text-foreground">{dayHeading(props.day)}</h2>
        <span class="text-xs text-muted-foreground">
          <Show when={props.day.cityName}>{props.day.cityName} · </Show>
          <Show when={counts().planned > 0} fallback="Nothing planned">
            {counts().visited} of {counts().planned} visited
          </Show>
        </span>
      </header>

      <label class="sr-only" for={`diary-${props.day.id}`}>
        Notes for {dayHeading(props.day)}
      </label>
      <textarea
        id={`diary-${props.day.id}`}
        class="w-full resize-y rounded-2xl border border-input bg-background p-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        rows={3}
        maxLength={4000}
        placeholder="How did the day go?"
        value={props.draft}
        onInput={(e) => props.onDraft(e.currentTarget.value)}
        onBlur={save}
      />

      <Show when={props.day.stops.length > 0}>
        <ol class="mt-4 divide-y divide-border">
          <For each={props.day.stops}>
            {(stop) => (
              <li class="py-2.5">
                <div class="flex items-center justify-between gap-3">
                  <span class="flex min-w-0 items-center gap-2">
                    <span
                      class={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${stop.visitedAt ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                      aria-label={stop.visitedAt ? "Visited" : "Not visited"}
                    >
                      <Show when={stop.visitedAt}>
                        <Check class="h-3 w-3" />
                      </Show>
                    </span>
                    <span class="truncate text-foreground">{stop.name}</span>
                  </span>
                  <span class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <Show when={stop.verdict}>
                      {(v) => (
                        <span class="rounded-full border border-border px-2 py-0.5">
                          {VERDICT_LABEL.get(v())}
                        </span>
                      )}
                    </Show>
                    {time(stop.visitedAt)}
                    <Show when={props.photosEnabled}>
                      <AddPhotosButton
                        label="Photo"
                        busy={props.uploading}
                        onFiles={(files) => props.onAddPhotos(files, stop.id)}
                      />
                    </Show>
                  </span>
                </div>
                <Show when={stop.notes}>
                  <p class="mt-1 pl-7 text-sm text-muted-foreground">{stop.notes}</p>
                </Show>
                <div class="pl-7">
                  <PhotoStrip photos={stop.photos} onDelete={props.onDeletePhoto} />
                </div>
              </li>
            )}
          </For>
        </ol>
      </Show>

      <Show when={props.day.extras.length > 0}>
        <h3 class="kicker mb-1 mt-4">Also visited</h3>
        <ul class="divide-y divide-border">
          <For each={props.day.extras}>
            {(visit) => (
              <li class="flex items-center justify-between gap-3 py-2 text-sm">
                <span class="truncate text-foreground">{visit.name || "Unnamed place"}</span>
                <span class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <Show when={visit.verdict}>
                    {(v) => (
                      <span class="rounded-full border border-border px-2 py-0.5">
                        {VERDICT_LABEL.get(v())}
                      </span>
                    )}
                  </Show>
                  {time(visit.visitedAt)}
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <PhotoStrip photos={props.day.photos} onDelete={props.onDeletePhoto} />
      <Show when={props.photosEnabled}>
        <div class="mt-3">
          <AddPhotosButton
            label="Add photos"
            busy={props.uploading}
            onFiles={(files) => props.onAddPhotos(files)}
          />
        </div>
      </Show>
    </section>
  );
}
