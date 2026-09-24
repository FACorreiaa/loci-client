import { Show, type JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Cloud, Smartphone, Trash2 } from "lucide-solid";
import { ShareMenu } from "~/components/ShareMenu";
import { SHARE_HOME_URL } from "~/lib/share";
import type { SavedItem, SavedItineraryItem } from "~/lib/saved/types";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const meta = "font-coord text-[10px] uppercase tracking-[0.12em] text-muted-foreground";

interface Props {
  item: SavedItem;
  onRemove: (item: SavedItem) => void;
  removing: boolean;
}

/**
 * One row for every kind of saved thing. A row is a link when there is
 * something to open and plain text when there is not — a saved item that
 * cannot be opened still belongs in the list, but must not pretend.
 */
export default function SavedRow(props: Props) {
  const item = () => props.item;

  const body = (): JSX.Element => (
    <>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-foreground">{item().title}</p>
        <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <Show when={item().cityName}>
            <span class="text-xs text-muted-foreground">{item().cityName}</span>
          </Show>
          <Show when={item().savedAt}>
            <span class={meta}>{formatDate(item().savedAt)}</span>
          </Show>
          <Show when={item().kind === "itinerary" && (item() as { stopCount?: number }).stopCount}>
            <span class={meta}>{(item() as { stopCount?: number }).stopCount} stops</span>
          </Show>
          <Show when={item().kind === "itinerary" && (item() as { offlineId?: string }).offlineId}>
            <span class={`${meta} inline-flex items-center gap-1 text-primary`}>
              <Smartphone class="h-3 w-3" aria-hidden="true" />
              On this device
            </span>
          </Show>
          <Show when={item().kind === "itinerary" && (item() as { cloudId?: string }).cloudId}>
            <span class={`${meta} inline-flex items-center gap-1`}>
              <Cloud class="h-3 w-3" aria-hidden="true" />
              Account
            </span>
          </Show>
        </div>
      </div>
      <span class={`${meta} shrink-0`}>{item().typeLabel}</span>
    </>
  );

  return (
    <li class="flex items-start gap-3 py-3">
      <Show
        when={item().href}
        fallback={<div class="flex min-w-0 flex-1 items-start gap-4 opacity-80">{body()}</div>}
      >
        {(href) => (
          <A
            href={href()}
            class="flex min-w-0 flex-1 items-start gap-4 transition-opacity hover:opacity-70"
          >
            {body()}
          </A>
        )}
      </Show>

      <div class="flex shrink-0 items-center gap-1">
        {/* Only an itinerary has something worth sharing, and only one that
            opens: the share text is built from what the reader can see. */}
        <Show when={item().kind === "itinerary" && item().href}>
          <ShareMenu
            payload={{
              cityName: item().cityName,
              title: item().title,
              description: (item() as SavedItineraryItem).description,
              stopCount: (item() as SavedItineraryItem).stopCount,
              url: SHARE_HOME_URL,
            }}
          />
        </Show>
        <button
          type="button"
          disabled={props.removing}
          onClick={() => props.onRemove(item())}
          class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          title="Remove"
          aria-label={`Remove ${item().title}`}
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
