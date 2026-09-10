import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Vitest previously ran on bare defaults, which worked only because every test
 * lived under src/lib and imported relatively. Anything under src/components
 * uses the `@`/`~` aliases, so testing a component failed at import time with
 * "Cannot find module '~/lib/theme-colors'".
 *
 * These are the same two aliases vite.config.ts defines for the app build; they
 * are duplicated rather than imported because vite.config.ts also loads the SolidStart
 * config, not a plain Vite one.
 */
export default defineConfig({
  // solid-js ships a server build selected by the "node" condition, whose
  // createEffect/onMount are inert and whose isServer is true. Tests of hooks
  // and stores need the browser build, the one the app actually runs. Pinned
  // by alias rather than `resolve.conditions`: vitest externalizes some solid
  // entry points to Node's resolver and inlines others, and a dev `store` on
  // top of a prod core throws at import ("registerGraph" of undefined).
  resolve: {
    alias: [
      { find: /^solid-js$/, replacement: "solid-js/dist/solid.js" },
      { find: /^solid-js\/store$/, replacement: "solid-js/store/dist/store.js" },
      { find: /^solid-js\/web$/, replacement: "solid-js/web/dist/web.js" },
      { find: /^@\//, replacement: `${path.resolve(__dirname, "./src")}/` },
      { find: /^~\//, replacement: `${path.resolve(__dirname, "./src")}/` },
    ],
  },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/.claude/**", "**/.output/**"],
    server: {
      deps: {
        inline: [/solid-js/],
      },
    },
  },
});
