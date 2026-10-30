import { Component, Show } from "solid-js";
import { Download, Share2, Bookmark, WifiOff, Loader2 } from "lucide-solid";
import { ShareMenu } from "~/components/ShareMenu";
import type { SharePayload } from "~/lib/share";

interface ActionToolbarProps {
  onDownload?: () => void;
  /** @deprecated Use sharePayload instead for the enhanced ShareMenu. */
  onShare?: () => void;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  onSaveOffline?: () => void;
  isSavedOffline?: boolean;
  /** When provided, renders the ShareMenu dropdown instead of a plain button. */
  sharePayload?: SharePayload;
  /**
   * One Save: on the device first, then the account. Replaces the separate
   * bookmark and save-offline buttons on pages that adopt it.
   */
  onSave?: () => void;
  isSaved?: boolean;
  saving?: boolean;
  /** A short line next to the buttons, e.g. "Saved on this device". */
  status?: string;
}

// One vocabulary for every icon button in the bar: muted at rest, ink on
// hover, primary tint when the state is on. The previous per-button blue,
// emerald and green were the only places those hues appeared in the app.
const idleButton =
  "rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
const activeButton = "rounded-full p-2 bg-primary/10 text-primary transition-colors";

export const ActionToolbar: Component<ActionToolbarProps> = (props) => {
  return (
    <div class="island-panel flex w-fit items-center gap-2 rounded-full p-1.5">
      <Show when={props.onDownload}>
        <button
          type="button"
          onClick={props.onDownload}
          class={idleButton}
          title="Download data"
          aria-label="Download data"
        >
          <Download class="h-4 w-4" aria-hidden="true" />
        </button>
      </Show>

      <Show when={props.onSave}>
        <button
          type="button"
          onClick={props.onSave}
          disabled={props.saving}
          class={props.isSaved ? activeButton : idleButton}
          title={props.isSaved ? "Saved on this device" : "Save"}
          aria-label={props.isSaved ? "Saved on this device" : "Save"}
          aria-pressed={props.isSaved}
        >
          <Show
            when={!props.saving}
            fallback={<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />}
          >
            <Bookmark class={`h-4 w-4 ${props.isSaved ? "fill-current" : ""}`} aria-hidden="true" />
          </Show>
        </button>
      </Show>

      <Show when={props.onSaveOffline}>
        <button
          type="button"
          onClick={props.onSaveOffline}
          class={props.isSavedOffline ? activeButton : idleButton}
          title={props.isSavedOffline ? "Saved offline" : "Save for offline"}
          aria-label={props.isSavedOffline ? "Saved offline" : "Save for offline"}
          aria-pressed={props.isSavedOffline}
        >
          <WifiOff
            class={`h-4 w-4 ${props.isSavedOffline ? "fill-current" : ""}`}
            aria-hidden="true"
          />
        </button>
      </Show>

      <Show when={props.onBookmark}>
        <button
          type="button"
          onClick={props.onBookmark}
          class={props.isBookmarked ? activeButton : idleButton}
          title={props.isBookmarked ? "Saved to lists" : "Save to lists"}
          aria-label={props.isBookmarked ? "Saved to lists" : "Save to lists"}
          aria-pressed={props.isBookmarked}
        >
          <Bookmark
            class={`h-4 w-4 ${props.isBookmarked ? "fill-current" : ""}`}
            aria-hidden="true"
          />
        </button>
      </Show>

      {/* Enhanced ShareMenu when payload provided; plain share button as fallback */}
      <Show
        when={props.sharePayload}
        fallback={
          <Show when={props.onShare}>
            <button
              type="button"
              onClick={props.onShare}
              class={idleButton}
              title="Share"
              aria-label="Share"
            >
              <Share2 class="h-4 w-4" aria-hidden="true" />
            </button>
          </Show>
        }
      >
        {(payload) => <ShareMenu payload={payload()} />}
      </Show>

      <Show when={props.status}>
        <span role="status" class="pr-2 text-xs text-muted-foreground">
          {props.status}
        </span>
      </Show>
    </div>
  );
};
