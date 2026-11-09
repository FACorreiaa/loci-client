import type { SliderRootProps } from "@kobalte/core/slider";
import type { JSX } from "solid-js";

import { Slider as SliderPrimitive } from "@kobalte/core/slider";
import { For, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

type RangeSliderProps = Omit<SliderRootProps, "class"> & {
  class?: string;
  /** Accessible name for each thumb, in order ("Minimum price", ...). */
  thumbLabels: string[];
  label?: JSX.Element;
};

/**
 * A one- or two-thumb slider on Kobalte's Slider: keyboard (arrows, Page
 * Up/Down, Home/End) and screen-reader support come from the primitive.
 */
export const RangeSlider = (props: RangeSliderProps) => {
  const [local, rest] = splitProps(props, ["class", "thumbLabels", "label"]);
  return (
    <SliderPrimitive
      class={cn("relative flex w-full touch-none select-none flex-col gap-2", local.class)}
      {...rest}
    >
      {local.label}
      <SliderPrimitive.Track class="relative h-1.5 w-full grow rounded-full bg-muted">
        <SliderPrimitive.Fill class="absolute h-full rounded-full bg-primary" />
        <For each={local.thumbLabels}>
          {(label) => (
            <SliderPrimitive.Thumb
              aria-label={label}
              class="-top-[5px] block size-4 rounded-full border-2 border-primary bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <SliderPrimitive.Input />
            </SliderPrimitive.Thumb>
          )}
        </For>
      </SliderPrimitive.Track>
    </SliderPrimitive>
  );
};
