import type { JSX } from "solid-js";

/**
 * The Loci mark and lockup as inline SVG.
 *
 * Inline rather than an <img> pointing at public/images/brand/mark.svg so the
 * mark inherits `currentColor` and themes with the text beside it, and so a
 * header costs no extra request. The geometry is the same as the files in
 * public/images/brand — those exist for surfaces outside the app (README, the
 * app stores, social cards). If one changes, change both; where the numbers
 * come from is documented in public/images/brand/README.md.
 */

// Everything below the head. Traced from the approved art's coral mask, since
// the taper and the foot's bevel are not the straight edges they look like. The
// head is a circle primitive so it stays round at any size.
const MARK_BODY =
  "M194 97 L193 116 L188 134 L182 147 L160 181 L149 210 L113 390 L360 392 L362 394 L360 400 L297 486 L289 493 L271 495 L78 495 L59 494 L49 487 L46 478 L45 219 L41 200 L34 182 L13 149 L5 132 L0 112 L0 97 Z";

// "oci". Traced too: the brand has no licensed typeface, and a lockup that
// depends on one installed locally renders differently wherever it is not.
const WORDMARK_OCI =
  "M11102 6946 c-592 -292 -575 -1095 28 -1310 451 -161 950 189 950 668 0 477 -563 847 -978 642z M2390 5096 c-3 -3 -54 -10 -113 -15 -1098 -104 -1978 -900 -2216 -2004 -18 -82 -39 -167 -47 -189 -18 -51 -21 -639 -3 -685 6 -15 28 -104 50 -198 226 -980 944 -1710 1889 -1925 52 -11 142 -33 200 -48 160 -40 668 -46 823 -8 56 13 154 36 217 51 767 179 1455 750 1732 1438 630 1566 -229 3230 -1827 3537 -167 32 -686 66 -705 46z m371 -1051 c753 -112 1262 -718 1262 -1500 -1 -1139 -1134 -1849 -2125 -1333 -535 279 -864 917 -779 1512 125 872 832 1441 1642 1321z M7850 5088 c-1152 -159 -1988 -926 -2211 -2029 -279 -1384 544 -2675 1904 -2985 84 -19 179 -43 213 -54 153 -51 736 -23 1004 47 541 142 929 366 1237 715 238 270 238 274 15 445 -665 510 -614 487 -743 327 -382 -474 -1098 -644 -1677 -399 -890 375 -1186 1537 -592 2326 565 752 1623 775 2291 50 92 -100 111 -100 251 7 57 43 206 156 332 252 367 279 358 259 204 447 -386 473 -930 762 -1603 852 -94 13 -531 12 -625 -1z M10894 4986 c-57 -25 -54 102 -54 -2448 0 -2629 -6 -2427 67 -2448 96 -28 982 -8 1009 23 24 28 24 28 24 2411 0 2577 3 2437 -56 2462 -48 20 -944 20 -990 0z";

type MarkProps = {
  class?: string;
  /** Set when the mark is the only thing naming the brand in its region. */
  label?: string;
};

/**
 * The pin-as-L on its own, in `currentColor`. For avatars, loading states, and
 * anywhere the word "Loci" already sits alongside.
 */
export function LociMark(props: MarkProps): JSX.Element {
  return (
    <svg
      class={props.class}
      viewBox="0 0 362 496"
      fill="currentColor"
      role={props.label ? "img" : "presentation"}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : "true"}
    >
      <circle cx="97" cy="97" r="97" />
      <path d={MARK_BODY} />
    </svg>
  );
}

/**
 * The full lockup: the mark doing double duty as the "L", then "oci".
 *
 * The mark keeps the brand coral at every size; the letters take `currentColor`
 * so they stay legible on whichever surface the lockup lands on. Size it by
 * height (`class="h-8"`) — the viewBox carries the aspect ratio.
 */
export function LociLogo(props: { class?: string }): JSX.Element {
  return (
    <svg class={props.class} viewBox="0 0 1093 500" fill="none" role="img" aria-label="Loci">
      <g fill="var(--brand-coral, #FA7862)">
        <circle cx="97" cy="97" r="97" />
        <path d={MARK_BODY} />
      </g>
      <g fill="currentColor" transform="translate(398.8 499.91) scale(0.0574586 -0.0574586)">
        <path d={WORDMARK_OCI} />
      </g>
    </svg>
  );
}
