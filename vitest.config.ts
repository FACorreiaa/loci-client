import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

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
  // Compiles .tsx with Solid's JSX transform so component tests can render the
  // real components. Without it esbuild emits React.createElement calls.
  // `hot: false` — HMR wiring is meaningless under vitest.
  plugins: [solid({ hot: false })],
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
    setupFiles: ["./src/test/happy-dom-setup.ts"],
    exclude: ["**/node_modules/**", "**/.claude/**", "**/.output/**"],
    // CI runs `vitest run --changed <base>` on pull requests: only the tests
    // whose import graph a change touches. A file listed here reruns the whole
    // suite instead, because it can change any test without being imported by
    // one. The default covers package.json; its vite/vitest config glob does
    // not match a plain `vitest.config.ts`, so both configs are named here.
    forceRerunTriggers: [
      ...configDefaults.forceRerunTriggers,
      "**/vitest.config.ts",
      "**/vite.config.ts",
      "**/pnpm-lock.yaml",
      "**/pnpm-workspace.yaml",
      "**/tsconfig.json",
    ],
    server: {
      deps: {
        inline: [/solid-js/],
      },
    },
  },
});
