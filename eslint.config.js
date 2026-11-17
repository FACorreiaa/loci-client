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
      // losing reactivity. Left as a warning while the long stateful files are
      // split (docs/UI_AUDIT_2026-09.md phase 2); raise to "error" after.
      "solid/reactivity": "warn", // 71 hits on 2026-11-17
      // BACKLOG: an error in the plugin's preset, three `.map()` over a
      // constant array today. Fix them, then delete this line.
      "solid/prefer-for": "warn", // 3
    },
  },
  // Last: turns off any rule oxlint already runs, so the two never overlap.
  ...oxlint.buildFromOxlintConfigFile("./.oxlintrc.json"),
];
