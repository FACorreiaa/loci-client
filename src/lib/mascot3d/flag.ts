/**
 * Whether this build carries the 3D mascot (BRD-001), and where its model is.
 * Set only by the beta deployment (.github/workflows/deploy-beta.yml). Vite
 * inlines it. Branches that decide whether to ship 3D code read
 * import.meta.env.VITE_MASCOT_3D_URL directly instead, so the bundler can fold
 * them (it does not fold constants across modules).
 */
export const MASCOT_3D_URL: string = import.meta.env.VITE_MASCOT_3D_URL ?? "";
