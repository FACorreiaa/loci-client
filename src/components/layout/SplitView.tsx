import { createSignal, JSX, Show } from "solid-js";
import { Map, List, Sidebar, Maximize2, Minimize2 } from "lucide-solid";

interface SplitViewProps {
  listContent: JSX.Element;
  mapContent: JSX.Element;
  initialMode?: "split" | "list" | "map";
  /**
   * What a phone gets.
   *
   *   toggle  a List / Map switch above one panel at a time (the default, and
   *           what /itinerary uses).
   *   hero    the map as a card on top of the list, the page scrolling as one
   *           column; a tap on the card opens it out. The result pages use
   *           this: a list of hotels wants the map in view, not behind a tab.
   *
   * Neither changes desktop, which keeps the split.
   */
  mobile?: "toggle" | "hero";
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
  const hero = () => props.mobile === "hero";
  // Hero only: whether the map card has been opened out on a phone.
  const [expanded, setExpanded] = createSignal(false);

  // In hero mode the mode only applies from `md:` up; a phone always shows
  // both panels, stacked.
  const listPanelClass = () => {
    const m = mode();
    if (hero()) {
      return m === "map"
        ? "md:hidden md:w-0"
        : m === "split"
          ? "md:w-1/2 md:max-w-[600px] md:border-r md:border-border"
          : "md:w-full";
    }
    return m === "map"
      ? "hidden w-0"
      : m === "split"
        ? "w-1/2 md:max-w-[600px] border-r border-border"
        : "w-full";
  };
  const mapPanelClass = () => {
    const m = mode();
    if (hero()) {
      return m === "list" ? "md:hidden md:w-0" : m === "split" ? "md:w-1/2" : "md:w-full";
    }
    return m === "list" ? "hidden w-0" : m === "split" ? "w-1/2" : "w-full";
  };

  return (
    <div
      class={`flex flex-col h-[calc(100vh-4rem)] bg-background ${
        hero() ? "overflow-y-auto md:overflow-hidden" : "overflow-hidden"
      }`}
    >
      {/* Mobile Toggle Controls */}
      <Show when={!hero()}>
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
      </Show>

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

      <div
        class={`flex-1 flex relative ${
          hero() ? "flex-col md:flex-row overflow-visible md:overflow-hidden" : "overflow-hidden"
        }`}
      >
        {/* List Panel */}
        <div
          class={`flex-1 motion-settle bg-background ${listPanelClass()} ${
            hero()
              ? "h-auto overflow-visible md:h-full md:overflow-y-auto"
              : "h-full overflow-y-auto"
          }`}
        >
          <div class="h-full relative z-0">{props.listContent}</div>
        </div>

        {/* Map Panel. In hero mode it is the first thing on a phone: a card
            of fixed height that opens out on tap, and the map's own resize
            observer follows the height change. */}
        <div
          class={`motion-settle relative z-0 ${mapPanelClass()} ${
            hero()
              ? `order-first md:order-none shrink-0 mx-4 mt-4 overflow-hidden rounded-2xl border border-border shadow-sm transition-[height] duration-300 md:mx-0 md:mt-0 md:h-full md:flex-1 md:rounded-none md:border-0 md:shadow-none ${
                  expanded() ? "h-[70vh]" : "h-56"
                }`
              : "flex-1 h-full"
          }`}
        >
          {props.mapContent}

          <Show when={hero()}>
            {/* Collapsed: a static hero — the whole card is one tap target,
                so a scroll through the page never gets caught by the map.
                Opened out: the map is live and the chip closes it again. */}
            <Show when={!expanded()}>
              <button
                type="button"
                class="absolute inset-0 z-10 md:hidden"
                aria-label="Expand map"
                onClick={() => setExpanded(true)}
              />
            </Show>
            <button
              type="button"
              class="island-panel absolute bottom-3 right-3 z-20 flex min-h-[40px] items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-foreground md:hidden"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded()}
            >
              <Show when={expanded()} fallback={<Maximize2 class="h-3.5 w-3.5" />}>
                <Minimize2 class="h-3.5 w-3.5" />
              </Show>
              {expanded() ? "Collapse map" : "Expand map"}
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
