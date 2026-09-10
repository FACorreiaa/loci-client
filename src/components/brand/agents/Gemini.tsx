// Ported verbatim from north-web-app web/shared/ui/icon/brand_gemini.templ:
// viewBox and path data are untouched. Not a Lucide icon — do not run it
// through any icon generator.
//
// Google's Gemini spark. The gradients are referenced by id, and ids are
// document-global, so each instance mints its own: two Gemini marks on one
// page would otherwise share (and, on removal, lose) the same <defs>.
import { createUniqueId } from "solid-js";
import type { BrandIconProps } from "./props";
import { a11y } from "./props";

export default function Gemini(props: BrandIconProps) {
  const uid = createUniqueId();
  const id = () => `gemini-${uid}`;
  return (
    <svg
      class={props.class}
      {...a11y(props)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill="#3186FF"
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill={`url(#${id()}-0)`}
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill={`url(#${id()}-1)`}
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill={`url(#${id()}-2)`}
      />
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`${id()}-0`}
          x1="7"
          x2="11"
          y1="15.5"
          y2="12"
        >
          <stop stop-color="#08B962" />
          <stop offset="1" stop-color="#08B962" stop-opacity="0" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`${id()}-1`}
          x1="8"
          x2="11.5"
          y1="5.5"
          y2="11"
        >
          <stop stop-color="#F94543" />
          <stop offset="1" stop-color="#F94543" stop-opacity="0" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`${id()}-2`}
          x1="3.5"
          x2="17.5"
          y1="13.5"
          y2="12"
        >
          <stop stop-color="#FABC12" />
          <stop offset=".46" stop-color="#FABC12" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
