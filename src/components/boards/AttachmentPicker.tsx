import { createMemo, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { MapPin, Route, X } from "lucide-solid";
import { ContentType } from "@buf/loci_loci-proto.bufbuild_es/loci/favorites/v1/favorites_pb.js";
import { useSavedItems } from "~/lib/saved/use-saved-items";
import { isOpenableId } from "~/lib/saved/collect";
import type { SavedItem } from "~/lib/saved/types";
import type { AttachmentKindName } from "~/lib/api/boards";
import { cn } from "~/lib/utils";

export interface PickedAttachment {
  kind: AttachmentKindName;
  ref: string;
  title: string;
  city: string;
}

/**
 * What from Saved can go on a post: itineraries kept on the account (a copy
 * that lives only on this device has no id the server knows) and places that
 * are real POIs. The server re-checks that an itinerary is the poster's own.
 */
export const attachable = (item: SavedItem): PickedAttachment | undefined => {
  if (item.kind === "itinerary") {
    return item.cloudId
      ? { kind: "itinerary", ref: item.cloudId, title: item.title, city: item.cityName }
      : undefined;
  }
  const poi = item.contentType !== ContentType.HOTEL && item.contentType !== ContentType.RESTAURANT;
  return poi && isOpenableId(item.itemId)
    ? { kind: "poi", ref: item.itemId.trim(), title: item.title, city: item.cityName }
    : undefined;
};

/** Pick one saved itinerary or place to attach to a post. */
export default function AttachmentPicker(props: {
  value?: PickedAttachment;
  onChange: (a?: PickedAttachment) => void;
}) {
  const saved = useSavedItems();
  const options = createMemo(() =>
    saved.items().flatMap((i) => {
      const a = attachable(i);
      return a ? [a] : [];
    }),
  );
  const [open, setOpen] = createSignal(false);

  return (
    <div>
      <Show
        when={props.value}
        fallback={
          <button
            type="button"
            class="text-sm font-medium text-primary hover:underline"
            onClick={() => setOpen(!open())}
            aria-expanded={open()}
          >
            {open() ? "Hide saved items" : "Attach something from Saved"}
          </button>
        }
      >
        {(v) => (
          <div class="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
            {v().kind === "itinerary" ? (
              <Route class="h-4 w-4 text-primary" aria-hidden="true" />
            ) : (
              <MapPin class="h-4 w-4 text-primary" aria-hidden="true" />
            )}
            <span class="min-w-0 flex-1 truncate">
              {v().title}
              <Show when={v().city}>
                <span class="text-muted-foreground"> · {v().city}</span>
              </Show>
            </span>
            <button
              type="button"
              class="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Remove attachment"
              onClick={() => props.onChange(undefined)}
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        )}
      </Show>

      <Show when={open() && !props.value}>
        <div class="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border">
          <Show when={saved.status() === "loading"}>
            <p class="p-4 text-sm text-muted-foreground">Loading your saved items…</p>
          </Show>
          <Show when={saved.status() !== "loading" && options().length === 0}>
            <p class="p-4 text-sm text-muted-foreground">
              Nothing to attach yet. Save an itinerary or a place first —{" "}
              <A href="/saved" class="text-primary underline">
                see Saved
              </A>
              .
            </p>
          </Show>
          <ul>
            <For each={options()}>
              {(o) => (
                <li>
                  <button
                    type="button"
                    class={cn(
                      "flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                    )}
                    onClick={() => {
                      props.onChange(o);
                      setOpen(false);
                    }}
                  >
                    {o.kind === "itinerary" ? (
                      <Route class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <MapPin class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span class="min-w-0 flex-1 truncate">{o.title}</span>
                    <span class="shrink-0 text-xs text-muted-foreground">{o.city}</span>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
}
