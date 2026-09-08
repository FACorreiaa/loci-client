import { createSignal, JSX } from "solid-js";
import { Map, List, Sidebar } from "lucide-solid";

interface SplitViewProps {
  listContent: JSX.Element;
  mapContent: JSX.Element;
  initialMode?: "split" | "list" | "map";
}

const toggleActive = "bg-primary text-primary-foreground shadow-sm";
const toggleIdle = "text-muted-foreground hover:bg-muted hover:text-foreground";

// Below this width the two panels would be half a phone each, so "split" is
// resolved to "list" instead. Matches the `md:` breakpoint the panels use.
const SPLIT_MIN_WIDTH = 768;

// resolveInitialMode keeps "split" honest on a narrow screen.
//
// It also exists because every results route used to pass initialMode="map",
// which gives the list panel `hidden w-0` — so the whole itinerary column was
// invisible on arrival and the only rendered pane said "No items to display on
// map". A page with content looked completely blank. Whatever the default is,
// it must not be the pane that has nothing in it.
function resolveInitialMode(requested: SplitViewProps["initialMode"]): "split" | "list" | "map" {
  const mode = requested || "split";
  if (mode !== "split") return mode;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    // SSR renders the list, which is the content. The client corrects to split
    // on its first render if the viewport is wide enough.
    return "list";
  }
  return window.matchMedia(`(min-width: ${SPLIT_MIN_WIDTH}px)`).matches ? "split" : "list";
}

export default function SplitView(props: SplitViewProps) {
  const [mode, setMode] = createSignal<"split" | "list" | "map">(
    resolveInitialMode(props.initialMode),
  );

  return (
    <div class="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Mobile Toggle Controls */}
      <div class="flex items-center justify-center p-2 gap-2 md:hidden island-panel border-b border-border z-10 sticky top-0">
        <button
          onClick={() => setMode("list")}
          class={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium motion-settle min-h-[44px] ${
            mode() === "list" ? toggleActive : toggleIdle
          }`}
        >
          <List class="w-4 h-4" />
          List
        </button>
        <button
          onClick={() => setMode("map")}
          class={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium motion-settle min-h-[44px] ${
            mode() === "map" ? toggleActive : toggleIdle
          }`}
        >
          <Map class="w-4 h-4" />
          Map
        </button>
      </div>

      {/* Desktop Toggle Controls (Top Right Overlay) */}
      <div class="hidden md:flex absolute top-20 right-4 z-20 island-panel rounded-lg p-1">
        <button
          onClick={() => setMode("list")}
          class={`p-2 rounded-md motion-settle min-h-[44px] min-w-[44px] flex items-center justify-center ${
            mode() === "list" ? "bg-secondary text-foreground" : toggleIdle
          }`}
          title="List Only"
        >
          <List class="w-5 h-5" />
        </button>
        <button
          onClick={() => setMode("split")}
          class={`p-2 rounded-md motion-settle min-h-[44px] min-w-[44px] flex items-center justify-center ${
            mode() === "split" ? "bg-secondary text-foreground" : toggleIdle
          }`}
          title="Split View"
        >
          <Sidebar class="w-5 h-5" />
        </button>
        <button
          onClick={() => setMode("map")}
          class={`p-2 rounded-md motion-settle min-h-[44px] min-w-[44px] flex items-center justify-center ${
            mode() === "map" ? "bg-secondary text-foreground" : toggleIdle
          }`}
          title="Map Only"
        >
          <Map class="w-5 h-5" />
        </button>
      </div>

      <div class="flex-1 flex overflow-hidden relative">
        {/* List Panel */}
        <div
          class={`flex-1 h-full overflow-y-auto motion-settle ${
            mode() === "map"
              ? "hidden w-0"
              : mode() === "split"
                ? "w-1/2 md:max-w-[600px] border-r border-border"
                : "w-full"
          } bg-background`}
        >
          <div class="h-full relative z-0">{props.listContent}</div>
        </div>

        {/* Map Panel */}
        <div
          class={`flex-1 h-full motion-settle relative z-0 ${
            mode() === "list" ? "hidden w-0" : mode() === "split" ? "w-1/2" : "w-full"
          }`}
        >
          {props.mapContent}
        </div>
      </div>
    </div>
  );
}
