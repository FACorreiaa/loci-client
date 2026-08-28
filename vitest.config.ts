import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Vitest previously ran on bare defaults, which worked only because every test
 * lived under src/lib and imported relatively. Anything under src/components
 * uses the `@`/`~` aliases, so testing a component failed at import time with
 * "Cannot find module '~/lib/theme-colors'".
 *
 * These are the same two aliases app.config.ts defines for the app build; they
 * are duplicated rather than imported because app.config.ts is a SolidStart
 * config, not a plain Vite one.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "~": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
