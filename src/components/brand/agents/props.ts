export interface BrandIconProps {
  class?: string;
  /**
   * Accessible name. Brand marks sit next to their label almost everywhere,
   * so they are decorative by default (`aria-hidden`); pass a label only when
   * the mark stands alone.
   */
  label?: string;
}

/** The ARIA attributes for a brand mark: named image when labelled, hidden otherwise. */
export function a11y(props: BrandIconProps) {
  return props.label
    ? ({ role: "img", "aria-label": props.label } as const)
    : ({ "aria-hidden": "true" } as const);
}
