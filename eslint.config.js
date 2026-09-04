import js from "@eslint/js";
import solid from "eslint-plugin-solid/configs/typescript";
import * as tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  // Global ignores - must be standalone object with only ignores key
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "dev-dist/**",
      "tmp/**",
      ".output/**",
      "public/_build/**",
      ".vinxi/**",
      ".wrangler/**",
      "worker-configuration.d.ts",
      "functions/**/*.js",
    ],
  },
  // Global languageOptions
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker,
      },
    },
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    ...solid,
    plugins: {
      ...solid.plugins,
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...solid.rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Catches the most common Solid bug: destructuring props or signals and
      // losing reactivity. Left as a warning while the long stateful files are
      // split (docs/UI_AUDIT_2026-09.md phase 2); raise to "error" after.
      "solid/reactivity": "warn",
    },
  },
  prettier,
];
