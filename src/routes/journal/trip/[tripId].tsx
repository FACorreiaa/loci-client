import { For, Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useParams } from "@solidjs/router";
import { BookOpen, ChevronLeft, Loader2 } from "lucide-solid";
import { ProtectedRoute } from "~/contexts/AuthContext";
import JournalDay, { AddPhotosButton, PhotoStrip } from "~/components/journal/JournalDay";
import { useAddPhotos, useDeletePhoto, useSetDayDiary, useTripJournal } from "~/lib/api/journal";
import { showToast } from "~/lib/toast-store";

/**
 * The trip journal: each day as it went, with the traveller's own note and
 * photos. Planned stops show whether they were visited and how they were
 * rated; places visited off the plan are listed under the day they fell on.
 */
function JournalPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = () => params.tripId;
  const query = useTripJournal(tripId);
  // Guarded: `.data` suspends while pending.
  const journal = () => (query.isSuccess ? query.data : undefined);
  const diary = useSetDayDiary(tripId);
  const photos = useAddPhotos();
  const remove = useDeletePhoto(tripId);

  const addPhotos = async (files: File[], dayId?: string, stopId?: string) => {
    const res = await photos
      .mutateAsync({ target: { tripId: tripId(), dayId, stopId }, files })
      .catch(() => undefined);
    if (!res || res.failed > 0) {
      showToast({
        id: "journal-photos",
        title:
          res && res.saved > 0
            ? `Added ${res.saved}, ${res.failed} didn't upload.`
            : "Couldn't add those photos. Try again.",
      });
    }
  };

  const saveDiary = (dayId: string, text: string) =>
    diary.mutate(
      { dayId, text },
      { onError: () => showToast({ id: "journal-diary", title: "Couldn't save that note." }) },
    );

  return (
    <>
      <Title>{`${journal()?.title || "Trip"} journal · Loci`}</Title>
      <Meta name="robots" content="noindex" />
      <main class="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <A
          href={`/trips/${tripId()}`}
          class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft class="w-4 h-4" />
          Back to the trip
        </A>

        <Show when={query.isLoading}>
          <div class="grid place-items-center py-24 text-muted-foreground">
            <Loader2 class="h-6 w-6 animate-spin" aria-label="Loading the journal" />
          </div>
        </Show>

        <Show when={query.isError}>
          <section class="loci-card mx-auto mt-12 max-w-lg rounded-3xl p-8 text-center">
            <h1 class="text-2xl">No journal for this trip</h1>
            <p class="mt-2 text-muted-foreground">It may have been deleted, or it isn't yours.</p>
          </section>
        </Show>

        <Show when={journal()} keyed>
          {(j) => (
            <>
              <header class="mb-8">
                <div class="flex items-center gap-3 mb-2">
                  <div class="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen class="w-5 h-5 text-primary" />
                  </div>
                  <h1 class="text-2xl sm:text-3xl font-bold text-foreground">{j.title}</h1>
                </div>
                <p class="text-muted-foreground text-sm sm:text-base">
                  Your trip day by day. Write a line for each day
                  <Show when={j.photosEnabled}> and add your photos</Show>; only you can see this.
                </p>
              </header>

              <Show
                when={j.days.length > 0}
                fallback={
                  <p class="loci-card rounded-3xl p-6 text-sm text-muted-foreground">
                    This trip has no days yet. Plan a day and it shows up here.
                  </p>
                }
              >
                <div class="space-y-6">
                  <For each={j.days}>
                    {(day) => (
                      <JournalDay
                        day={day}
                        photosEnabled={j.photosEnabled}
                        uploading={photos.isPending}
                        onSaveDiary={(text) => saveDiary(day.id, text)}
                        onAddPhotos={(files, stopId) => void addPhotos(files, day.id, stopId)}
                        onDeletePhoto={(id) => remove.mutate(id)}
                      />
                    )}
                  </For>
                </div>
              </Show>

              <Show when={j.tripPhotos.length > 0 || j.photosEnabled}>
                <section class="loci-card mt-6 rounded-3xl p-5 sm:p-6" aria-label="Trip photos">
                  <h2 class="kicker mb-1">From the trip</h2>
                  <PhotoStrip photos={j.tripPhotos} onDelete={(id) => remove.mutate(id)} />
                  <Show when={j.photosEnabled}>
                    <div class="mt-3">
                      <AddPhotosButton
                        label="Add photos"
                        busy={photos.isPending}
                        onFiles={(files) => void addPhotos(files)}
                      />
                    </div>
                  </Show>
                </section>
              </Show>
            </>
          )}
        </Show>
      </main>
    </>
  );
}

export default function TripJournalRoute() {
  return (
    <ProtectedRoute>
      <JournalPage />
    </ProtectedRoute>
  );
}
