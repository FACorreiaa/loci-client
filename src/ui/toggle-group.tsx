import { cn } from "~/lib/utils";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { ToggleGroupItemProps, ToggleGroupRootProps } from "@kobalte/core/toggle-group";
import { ToggleGroup as ToggleGroupPrimitive } from "@kobalte/core/toggle-group";
import type { VariantProps } from "class-variance-authority";
import type { Accessor, ValidComponent } from "solid-js";
import { createContext, splitProps, useContext } from "solid-js";
import { toggleVariants } from "./toggle";

/**
 * Multi-select toggle group.
 *
 * Added because the map legend needs several layers on at once, and the only
 * grouped control in the app was a Kobalte radiogroup hand-rolled in
 * GlobeControls — which is single-select by construction. Styling reuses
 * `toggleVariants` so a grouped toggle and a standalone one cannot drift apart.
 */
const defaultVariants: VariantProps<typeof toggleVariants> = {
  size: "default",
  variant: "default",
};

const ToggleGroupContext = createContext<Accessor<VariantProps<typeof toggleVariants>>>();

type toggleGroupProps<T extends ValidComponent = "div"> = ToggleGroupRootProps<T> &
  VariantProps<typeof toggleVariants> & {
    class?: string;
    children?: import("solid-js").JSX.Element;
  };

export const ToggleGroup = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, toggleGroupProps<T>>,
) => {
  const [local, rest] = splitProps(props as toggleGroupProps, [
    "class",
    "children",
    "size",
    "variant",
  ]);

  return (
    <ToggleGroupPrimitive
      class={cn("flex items-center justify-center gap-1", local.class)}
      {...rest}
    >
      <ToggleGroupContext.Provider value={() => ({ size: local.size, variant: local.variant })}>
        {local.children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
};

type toggleGroupItemProps<T extends ValidComponent = "button"> = ToggleGroupItemProps<T> &
  VariantProps<typeof toggleVariants> & {
    class?: string;
  };

export const ToggleGroupItem = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, toggleGroupItemProps<T>>,
) => {
  const [local, rest] = splitProps(props as toggleGroupItemProps, ["class", "size", "variant"]);
  // The context is absent when an item is used outside a group, which is a
  // legitimate thing to do; fall back rather than crash.
  const context = useContext(ToggleGroupContext);
  const variants = () => context?.() ?? defaultVariants;

  return (
    <ToggleGroupPrimitive.Item
      class={cn(
        toggleVariants({
          variant: variants().variant ?? local.variant,
          size: variants().size ?? local.size,
        }),
        local.class,
      )}
      {...rest}
    />
  );
};
