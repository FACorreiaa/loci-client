import { Component, For, Show, createSignal } from "solid-js";
import { X } from "lucide-solid";
import { useDeleteWatch, useWatches, watchErrorMessage, type Watch } from "~/lib/api/watches";

export interface StandingTasksViewProps {
  watches: Watch[];
  onDelete: (id: string) => void;
  deletingId?: string | null;
  error?: string | null;
}

/** The list itself; renders nothing when there are no standing tasks. */
export const StandingTasksView: Component<StandingTasksViewProps> = (props) => (
  <Show when={props.watches.length > 0}>
    <section class="mb-4" aria-labelledby="standing-tasks-heading" data-testid="standing-tasks">
      <h3
        id="standing-tasks-heading"
        class="mb-2 text-xs font-medium text-muted-foreground sm:mb-3 sm:text-sm"
      >
        Standing tasks
      </h3>
      <ul class="space-y-1">
        <For each={props.watches}>
          {(watch) => (
            <li class="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium text-foreground sm:text-sm">{watch.title}</p>
                <p class="truncate text-xs text-muted-foreground">{watch.scheduleHuman}</p>
              </div>
              <button
                type="button"
                onClick={() => props.onDelete(watch.id)}
                disabled={props.deletingId === watch.id}
                class="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                aria-label={`Stop "${watch.title}"`}
                title="Stop this standing task"
              >
                <X class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          )}
        </For>
      </ul>
      <Show when={props.error}>
        <p role="alert" class="mt-1 px-2 text-xs text-destructive">
          {props.error}
        </p>
      </Show>
    </section>
  </Show>
);

/**
 * Sidebar section: ListWatches + DeleteWatch. A failed list stays quiet — the
 * section is an extra, and the rest of the sidebar must not look broken.
 */
const StandingTasksList: Component = () => {
  const watches = useWatches();
  const del = useDeleteWatch();
  const [deletingId, setDeletingId] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const onDelete = (id: string) => {
    setDeletingId(id);
    setError(null);
    del.mutate(id, {
      onError: (err) => setError(watchErrorMessage(err, "delete")),
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <StandingTasksView
      watches={watches.data ?? []}
      onDelete={onDelete}
      deletingId={deletingId()}
      error={error()}
    />
  );
};

export default StandingTasksList;
