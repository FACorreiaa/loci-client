import { Component, Show } from "solid-js";
import { Download, Share2, Bookmark, WifiOff } from "lucide-solid";
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
}

export const ActionToolbar: Component<ActionToolbarProps> = (props) => {
  return (
    <div class="flex items-center gap-2 p-1.5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-full border border-white/50 dark:border-white/10 shadow-sm w-fit transition-all hover:bg-white/80 dark:hover:bg-slate-900/80">
      <Show when={props.onDownload}>
        <button
          onClick={props.onDownload}
          class="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
          title="Download Data"
        >
          <Download class="w-4 h-4" />
        </button>
      </Show>

      <Show when={props.onSaveOffline}>
        <button
          onClick={props.onSaveOffline}
          class={`p-2 rounded-full transition-colors ${
            props.isSavedOffline
              ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10"
              : "text-gray-600 dark:text-gray-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          }`}
          title={props.isSavedOffline ? "Saved Offline" : "Save for Offline"}
        >
          <WifiOff class={`w-4 h-4 ${props.isSavedOffline ? "fill-current" : ""}`} />
        </button>
      </Show>

      <Show when={props.onBookmark}>
        <button
          onClick={props.onBookmark}
          class={`p-2 rounded-full transition-colors ${
            props.isBookmarked
              ? "text-blue-500 bg-blue-50 dark:bg-blue-900/10"
              : "text-gray-600 dark:text-gray-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          }`}
          title={props.isBookmarked ? "Saved to Lists" : "Save to Lists"}
        >
          <Bookmark class={`w-4 h-4 ${props.isBookmarked ? "fill-current" : ""}`} />
        </button>
      </Show>

      {/* Enhanced ShareMenu when payload provided; plain share button as fallback */}
      <Show
        when={props.sharePayload}
        fallback={
          <Show when={props.onShare}>
            <button
              onClick={props.onShare}
              class="p-2 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
              title="Share"
            >
              <Share2 class="w-4 h-4" />
            </button>
          </Show>
        }
      >
        {(payload) => <ShareMenu payload={payload()} />}
      </Show>
    </div>
  );
};
