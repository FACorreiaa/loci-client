// ESLint runs only what oxlint cannot: the eslint-plugin-solid rules
// (solid/reactivity and friends). Everything else is oxlint's job, see
// .oxlintrc.json. Parse-only: no Solid rule needs type information, so there
// is no `project`/`projectService` here and the run stays fast.
import solid from "eslint-plugin-solid/configs/typescript";
import * as tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import oxlint from "eslint-plugin-oxlint";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "dev-dist/**",
      "tmp/**",
      ".output/**",
      "public/**",
      ".vinxi/**",
      ".wrangler/**",
      "worker-configuration.d.ts",
    ],
  },
  {
    // Disable comments in the source also name rules that oxlint owns
    // (require-yield, @typescript-eslint/*). oxlint honours them; ESLint must
    // neither call them unused nor fail on a rule it does not know.
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    // @typescript-eslint is registered for those disable comments only: none
    // of its rules is switched on.
    plugins: { ...solid.plugins, "@typescript-eslint": tsPlugin },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...solid.rules,
      // Catches the most common Solid bug: destructuring props or signals and
      // losing reactivity. A warning in the plugin's preset; an error here.
      // A callback that runs later (a promise, a map event) reads the current
      // value when it runs and is correct: those carry an inline disable.
      "solid/reactivity": "error",
      // Also a warning in the preset. An early return in a component freezes
      // it on its first render.
      "solid/components-return-once": "error",
    },
  },
  // Last: turns off any rule oxlint already runs, so the two never overlap.
  ...oxlint.buildFromOxlintConfigFile("./.oxlintrc.json"),
];
