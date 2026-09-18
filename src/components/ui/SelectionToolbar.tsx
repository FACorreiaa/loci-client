import { Show } from "solid-js";
import { Download, X, CheckSquare } from "lucide-solid";
import { Button } from "~/ui/button";

interface SelectionToolbarProps {
  count: number;
  /** Omit where there is nothing real to export. */
  onExport?: () => void;
  onClear: () => void;
  onSelectAll?: () => void;
}

/**
 * Floating toolbar shown when items are selected
 * Provides export and clear selection actions
 */
export function SelectionToolbar(props: SelectionToolbarProps) {
  return (
    <Show when={props.count > 0}>
      <div class="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div class="flex items-center gap-3 px-5 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-full shadow-2xl border border-blue-500/50 backdrop-blur-sm">
          <div class="flex items-center gap-2">
            <CheckSquare class="w-4 h-4" />
            <span class="text-sm font-medium">
              {props.count} item{props.count > 1 ? "s" : ""} selected
            </span>
          </div>

          <div class="w-px h-5 bg-white/30" />

          <div class="flex items-center gap-2">
            <Show when={props.onSelectAll}>
              <Button
                variant="ghost"
                size="sm"
                onClick={props.onSelectAll}
                class="text-white hover:bg-white/20 hover:text-white gap-1.5 h-8"
              >
                <CheckSquare class="w-3.5 h-3.5" />
                Select All
              </Button>
            </Show>

            <Show when={props.onExport}>
              <Button
                variant="ghost"
                size="sm"
                onClick={props.onExport}
                class="text-white hover:bg-white/20 hover:text-white gap-1.5 h-8"
              >
                <Download class="w-3.5 h-3.5" />
                Export
              </Button>
            </Show>

            <Button
              variant="ghost"
              size="sm"
              onClick={props.onClear}
              class="text-white hover:bg-white/20 hover:text-white gap-1.5 h-8"
            >
              <X class="w-3.5 h-3.5" />
              Clear
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default SelectionToolbar;
