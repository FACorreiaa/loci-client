import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Check, Link2, Loader2, MapPin } from "lucide-solid";
import { Button } from "~/ui/button";
import { useLists } from "~/lib/api/lists";
import { useImportPlaces, useSaveImported } from "~/lib/api/link-import";
import {
  defaultListName,
  defaultSelection,
  importErrorMessage,
  retryAfterSave,
  savedAs,
  type ImportView,
  type SaveOutcome,
} from "~/lib/import/link-import";

const NEW_LIST = "__new__";

const field =
  "w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-ring";

/** Paste a link, see the places it mentions, keep the ones you want in a list. */
export default function ImportFromLink() {
  const [url, setUrl] = createSignal("");
  const [city, setCity] = createSignal("");
  const [view, setView] = createSignal<ImportView>();
  const [picked, setPicked] = createSignal<Set<string>>(new Set());
  const [listChoice, setListChoice] = createSignal(NEW_LIST);
  const [listName, setListName] = createSignal("");
  const [outcome, setOutcome] = createSignal<SaveOutcome>();
  // Lists this form created, until the lists query has them.
  const [created, setCreated] = createSignal<{ id: string; name: string }[]>([]);

  const importer = useImportPlaces();
  const saver = useSaveImported();
  const lists = useLists();

  const read = (e: Event) => {
    e.preventDefault();
    if (!url().trim()) return;
    setOutcome(undefined);
    importer.mutate(
      { url: url(), cityHint: city() },
      {
        onSuccess: (v) => {
          setView(v);
          setPicked(defaultSelection(v.places));
          setListChoice(NEW_LIST);
          setListName(defaultListName(v));
        },
      },
    );
  };

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const chosen = () => (view()?.places ?? []).filter((p) => p.poiId && picked().has(p.key));

  const save = () => {
    const places = chosen();
    if (places.length === 0) return;
    const target =
      listChoice() === NEW_LIST
        ? { newListName: listName().trim() || defaultListName(view()!) }
        : { listId: listChoice() };
    saver.mutate(
      { target, places },
      {
        onSuccess: (o) => {
          setOutcome(o);
          const made = o.created;
          if (made) setCreated((prev) => [...prev, made]);
          const next = retryAfterSave(o);
          setListChoice(next.listChoice);
          setPicked(next.picked);
        },
      },
    );
  };

  const savableLists = () => {
    const known = (lists.data ?? []).filter((l: any) => !l.isItinerary);
    const ids = new Set(known.map((l: any) => l.id));
    return [
      ...created().filter((l) => !ids.has(l.id)),
      ...known.map((l: any) => ({ id: l.id as string, name: l.name as string })),
    ];
  };

  return (
    <div class="space-y-6">
      <form onSubmit={read} class="loci-card rounded-3xl p-5 sm:p-6 space-y-3">
        <label class="block text-sm font-medium text-foreground" for="import-url">
          Link to a video, post, map pin or article
        </label>
        <input
          id="import-url"
          type="url"
          inputmode="url"
          autocomplete="off"
          value={url()}
          onInput={(e) => setUrl(e.currentTarget.value)}
          placeholder="https://www.tiktok.com/@…"
          class={field}
          data-testid="import-url"
          required
        />
        <label class="block text-sm font-medium text-foreground" for="import-city">
          City <span class="font-normal text-muted-foreground">(if the link doesn't say)</span>
        </label>
        <input
          id="import-city"
          type="text"
          value={city()}
          onInput={(e) => setCity(e.currentTarget.value)}
          placeholder="Lisbon"
          class={field}
        />
        <Button type="submit" class="gap-2" disabled={importer.isPending} data-testid="import-read">
          <Show when={importer.isPending} fallback={<Link2 class="w-4 h-4" />}>
            <Loader2 class="w-4 h-4 animate-spin" />
          </Show>
          {importer.isPending ? "Reading the link…" : "Find places"}
        </Button>
        <Show when={importer.isError}>
          <p class="text-sm text-destructive" role="alert">
            {importErrorMessage(importer.error)}
          </p>
        </Show>
      </form>

      <Show when={view()}>
        {(v) => (
          <section class="loci-card rounded-3xl p-5 sm:p-6" aria-label="Places in the link">
            <header class="mb-3">
              <p class="text-xs uppercase tracking-wide text-muted-foreground">
                {v().source}
                <Show when={v().city}> · {v().city}</Show>
              </p>
              <Show when={v().title}>
                <h2 class="text-lg font-semibold text-foreground line-clamp-2">{v().title}</h2>
              </Show>
            </header>

            <ul class="divide-y divide-border">
              <For each={v().places}>
                {(p) => (
                  <li class="py-2.5">
                    <label
                      class="flex items-start gap-3"
                      classList={{ "opacity-60": !p.poiId, "cursor-pointer": !!p.poiId }}
                    >
                      <input
                        type="checkbox"
                        class="mt-1 h-4 w-4"
                        checked={picked().has(p.key)}
                        disabled={!p.poiId}
                        onChange={() => toggle(p.key)}
                      />
                      <span class="min-w-0">
                        <span class="block font-medium text-foreground">{p.name}</span>
                        <Show when={savedAs(p)}>
                          {(name) => (
                            <span class="block text-xs text-foreground">Saves as {name()}</span>
                          )}
                        </Show>
                        <span class="block text-xs text-muted-foreground">
                          <Show
                            when={p.poiId}
                            fallback={<>Not found on Loci{p.city ? ` in ${p.city}` : ""}</>}
                          >
                            {[p.category, p.address ?? p.city].filter(Boolean).join(" · ")}
                          </Show>
                        </span>
                        <Show when={p.note}>
                          <span class="block text-sm text-muted-foreground italic">“{p.note}”</span>
                        </Show>
                      </span>
                    </label>
                  </li>
                )}
              </For>
            </ul>

            <div class="mt-4 space-y-3 border-t border-border pt-4">
              <label class="block text-sm font-medium text-foreground" for="import-list">
                Save to
              </label>
              <select
                id="import-list"
                class={field}
                value={listChoice()}
                onChange={(e) => setListChoice(e.currentTarget.value)}
              >
                <option value={NEW_LIST}>A new list</option>
                <For each={savableLists()}>{(l) => <option value={l.id}>{l.name}</option>}</For>
              </select>
              <Show when={listChoice() === NEW_LIST}>
                <input
                  type="text"
                  aria-label="New list name"
                  maxLength={60}
                  value={listName()}
                  onInput={(e) => setListName(e.currentTarget.value)}
                  class={field}
                />
              </Show>
              <Button
                class="gap-2"
                disabled={saver.isPending || chosen().length === 0}
                onClick={save}
                data-testid="import-save"
              >
                <Show when={saver.isPending} fallback={<MapPin class="w-4 h-4" />}>
                  <Loader2 class="w-4 h-4 animate-spin" />
                </Show>
                Save {chosen().length} {chosen().length === 1 ? "place" : "places"}
              </Button>
              <Show when={saver.isError}>
                <p class="text-sm text-destructive" role="alert">
                  Couldn't create the list. Try again.
                </p>
              </Show>
              <Show when={outcome()}>
                {(o) => (
                  <p class="flex items-center gap-2 text-sm text-foreground" role="status">
                    <Check class="w-4 h-4 text-primary" />
                    <span>
                      {o().added} saved
                      <Show when={o().already > 0}>, {o().already} already there</Show>
                      <Show when={o().failed > 0}>, {o().failed} didn't save</Show>.{" "}
                      <A href={`/lists/${o().listId}`} class="underline">
                        Open the list
                      </A>
                    </span>
                  </p>
                )}
              </Show>
            </div>
          </section>
        )}
      </Show>
    </div>
  );
}
