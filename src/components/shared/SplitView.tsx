import { Component, JSX, Show } from "solid-js";

interface SplitViewProps {
  children: JSX.Element;
  map?: JSX.Element;
  fab?: JSX.Element;
  className?: string;
}

export const SplitView: Component<SplitViewProps> = (props) => {
  return (
    <div class={`flex h-[calc(100vh-64px)] overflow-hidden bg-background ${props.className || ""}`}>
      {/* Scrollable Content Area */}
      <div class="w-full lg:w-1/2 h-full overflow-y-auto relative no-scrollbar">
        <div class="min-h-full pb-24 lg:pb-8">
          {" "}
          {/* Padding for FAB on mobile */}
          {props.children}
        </div>
      </div>

      {/* Map Area - Hidden on mobile, half width on desktop */}
      <div class="hidden lg:block lg:w-1/2 h-full relative border-l border-border">
        <Show
          when={props.map}
          fallback={
            <div class="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
              Map View
            </div>
          }
        >
          {props.map}
        </Show>
      </div>

      {/* Floating Action Button - Mobile/Tablet only typically, or accessible in content area */}
      <Show when={props.fab}>
        <div class="absolute bottom-6 right-6 z-50 lg:bottom-8 lg:right-1/2 lg:translate-x-1/2 lg:mr-8">
          {props.fab}
        </div>
      </Show>
    </div>
  );
};
