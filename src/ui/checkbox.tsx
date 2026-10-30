import { cn } from "~/lib/utils";
import type { CheckboxControlProps } from "@kobalte/core/checkbox";
import { Checkbox as CheckboxPrimitive } from "@kobalte/core/checkbox";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { ValidComponent, VoidProps } from "solid-js";
import { splitProps } from "solid-js";

export const CheckboxLabel = CheckboxPrimitive.Label;
export const Checkbox = CheckboxPrimitive;
export const CheckboxErrorMessage = CheckboxPrimitive.ErrorMessage;
export const CheckboxDescription = CheckboxPrimitive.Description;

type checkboxControlProps<T extends ValidComponent = "div"> = VoidProps<
  CheckboxControlProps<T> & {
    class?: string;
  }
>;

export const CheckboxControl = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, checkboxControlProps<T>>,
) => {
  const [local, rest] = splitProps(props as checkboxControlProps & { "aria-label"?: string }, [
    "class",
    "children",
    "aria-label",
  ]);

  // The accessible name belongs on the hidden input, not the visual control.
  // Kobalte's Label/Input pairing was observed to leave the input unnamed after
  // hydration (no `for`, no aria-labelledby), so callers may pass one directly.
  return (
    <>
      <CheckboxPrimitive.Input
        aria-label={local["aria-label"]}
        class="[&:focus-visible+div]:ring-2 [&:focus-visible+div]:ring-ring [&:focus-visible+div]:ring-offset-2"
      />
      <CheckboxPrimitive.Control
        class={cn(
          "h-5 w-5 shrink-0 rounded-lg transition-all",
          // Theme-aware styling
          "bg-background border-2 border-input",
          "shadow-sm",
          // Focus states
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // Checked states
          "data-[checked]:border-primary data-[checked]:bg-primary",
          "data-[checked]:text-primary-foreground",
          // Disabled states
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          local.class,
        )}
        {...rest}
      >
        <CheckboxPrimitive.Indicator class="flex items-center justify-center text-current">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4">
            <path
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
              d="m5 12l5 5L20 7"
            />
            <title>Checkbox</title>
          </svg>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Control>
    </>
  );
};
