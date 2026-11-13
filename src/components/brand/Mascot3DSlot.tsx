import { lazy, type Component } from "solid-js";

/**
 * Mascot3D, loaded only by builds that carry it. Lazy so a route's own
 * JavaScript does not grow by the component (scripts/size-budget.mjs holds
 * every route to its budget; only the lazy total may grow). The variable is
 * read here, not through ~/lib/mascot3d/flag, because the bundler folds an
 * inlined literal but not a constant imported from another module.
 */
const Mascot3DSlot: Component<Parameters<typeof import("./Mascot3D").default>[0]> = import.meta.env
  .VITE_MASCOT_3D_URL
  ? lazy(() => import("./Mascot3D"))
  : () => null;

export default Mascot3DSlot;
