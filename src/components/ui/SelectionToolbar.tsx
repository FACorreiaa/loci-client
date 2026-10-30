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
        <div
          class="flex items-center gap-3 rounded-full border border-foreground/20 bg-foreground px-5 py-3 text-background shadow-xl"
          role="toolbar"
          aria-label="Selection actions"
        >
          <div class="flex items-center gap-2">
            <CheckSquare class="w-4 h-4" aria-hidden="true" />
            <span class="text-sm font-medium" role="status">
              {props.count} item{props.count > 1 ? "s" : ""} selected
            </span>
          </div>

          <div class="w-px h-5 bg-background/30" />

          <div class="flex items-center gap-2">
            <Show when={props.onSelectAll}>
              <Button
                variant="ghost"
                size="sm"
                onClick={props.onSelectAll}
                class="h-8 gap-1.5 text-background hover:bg-background/15 hover:text-background"
              >
                <CheckSquare class="w-3.5 h-3.5" aria-hidden="true" />
                Select All
              </Button>
            </Show>

            <Show when={props.onExport}>
              <Button
                variant="ghost"
                size="sm"
                onClick={props.onExport}
                class="h-8 gap-1.5 text-background hover:bg-background/15 hover:text-background"
              >
                <Download class="w-3.5 h-3.5" aria-hidden="true" />
                Export
              </Button>
            </Show>

            <Button
              variant="ghost"
              size="sm"
              onClick={props.onClear}
              class="h-8 gap-1.5 text-background hover:bg-background/15 hover:text-background"
            >
              <X class="w-3.5 h-3.5" aria-hidden="true" />
              Clear
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default SelectionToolbar;
