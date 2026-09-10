# SolidStart v1 → v2 Migration Plan (loci-client)

Source of truth: <https://docs.solidjs.com/solid-start/v2/migrating-from-v1>

> **Status (2026-09-10): MIGRATED.** See §7. Sections 0–6 are the original plan and the
> June spike against `2.0.0-alpha.2`; kept for history. The alpha-era blocker was in the
> since-removed `@solidjs/vite-plugin-nitro-2` shim, not in SolidStart or Nitro v3.

> Not applicable here: the standing Loci rule (LLM resilience + monster-file splits
> mandatory in scope) targets the **server/llm-sdk** improvement plan. This is a
> frontend build-tooling migration — no LLM paths, no oversized source files touched.

---

## 0. Current state (what we're migrating from)

| Thing                         | Now                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Framework                     | `@solidjs/start ^1.2.0` on **Vinxi ^0.5.9**                                         |
| Config                        | `app.config.ts` (`defineConfig` from `@solidjs/start/config`)                       |
| Server preset                 | `server.preset: "cloudflare_module"` + `compatibilityDate: 2025-06-12`              |
| Vite plugins                  | `ensureHtmlShell` (custom), `@tailwindcss/vite`, `vite-plugin-pwa`                  |
| Aliases                       | `vite.resolve.alias` `@`→`./src`, `~`→`./src`                                       |
| Scripts                       | `vinxi dev` / `tsgo --noEmit && vinxi build` / `vinxi start`; deploy via `wrangler` |
| tsconfig `types`              | includes `vinxi/types/client`                                                       |
| `vinxi/http` imports in `src` | **none** (verified — zero runtime code changes)                                     |
| Middleware file               | **none**                                                                            |
| Deploy                        | Cloudflare (`wrangler.jsonc`), `build && wrangler deploy`                           |

**Good news:** no `vinxi/http` usage and no middleware → the app code is untouched.
The migration is almost entirely **config + dependencies + the Cloudflare/Nitro preset**.

---

## 1. Risks & unknowns — resolve via spike BEFORE touching main

These are the only things that can sink the migration. Spike each on a throwaway branch.

1. **Cloudflare preset under Nitro v2 plugin (HIGHEST RISK).**
   v1 set `server.preset: "cloudflare_module"` in `app.config.ts`. v2 moves the server
   to `@solidjs/vite-plugin-nitro-2` (`nitroV2Plugin()`). The guide's example shows
   `nitroV2Plugin()` with no args — it does **not** document how to pass the Cloudflare
   preset / `compatibilityDate`. Spike: confirm `nitroV2Plugin({ preset: "cloudflare_module", compatibilityDate: "..." })`
   (or a `nitro.config`/`NITRO_PRESET` env) produces a Workers-compatible build and the
   same output path `wrangler.jsonc` expects. **If this doesn't work cleanly on alpha, stop.**
2. **`vite-plugin-pwa` on Vite 7.** Currently `^1.2.0`. Verify Vite 7 compat; the custom
   `ensureHtmlShell` `transformIndexHtml` hack may behave differently now that SolidStart
   runs on native Vite (an index.html may finally exist). Re-test PWA manifest/SW injection.
3. **`@tailwindcss/vite` (Tailwind v4 plugin) on Vite 7** — usually fine, confirm.
4. **`nitropack` explicit dep (`^2.12.9`).** With `@solidjs/vite-plugin-nitro-2` owning
   Nitro, decide whether to keep, bump, or drop the direct dependency.
5. **Third-party alpha compat:** `@tanstack/solid-query` + devtools, `solid-icons`,
   `@solidjs/router ^0.15`, `@solidjs/meta ^0.29`, `vitest ^4`. Smoke-test each.
6. **Output dir change.** Vinxi emitted `.vinxi`/`.output`; Nitro v2 may differ. Update
   `wrangler.jsonc` `main`/assets paths and the `globPatterns`/build-output wiring.

**Spike exit criteria:** `vite build` produces a Cloudflare-deployable bundle, `wrangler dev`
serves it, PWA SW registers, app boots, auth + a streamed itinerary work.

---

## 2. Migration steps (after spike passes)

Do on a branch `chore/solidstart-v2`.

### 2.1 Dependencies

```bash
pnpm remove vinxi
pnpm add @solidjs/start@2.0.0-alpha.2 @solidjs/vite-plugin-nitro-2 vite@7
# reassess nitropack pin after nitro-2 plugin is in
```

### 2.2 Replace `app.config.ts` → `vite.config.ts`

Delete `app.config.ts`. Create `vite.config.ts`, **porting every plugin + the aliases**:

```ts title="vite.config.ts"
import { solidStart } from "@solidjs/start/config";
import { defineConfig, loadEnv } from "vite";
import { nitroV2Plugin } from "@solidjs/vite-plugin-nitro-2";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const _env = loadEnv(mode, process.cwd(), ""); // if any compile-time vars are needed
  return {
    plugins: [
      solidStart(/* { middleware: "./src/middleware/index.ts" } — only if we add one */),
      nitroV2Plugin({
        // SPIKE: confirm these keys are accepted by the nitro-2 plugin.
        preset: "cloudflare_module",
        compatibilityDate: "2025-06-12",
      }),
      tailwindcss() as any,
      // ensureHtmlShell — re-evaluate; may be unnecessary on native Vite (see Risk #2)
      VitePWA({ /* …copy registerType/workbox/manifest/devOptions verbatim… */ }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "~": path.resolve(__dirname, "./src"),
      },
    },
    // Compile-time env (only if we actually inline any). Example shape:
    // environments: { ssr: { define: { "process.env.X": JSON.stringify(_env.X) } } },
  };
});
```

> Keep `ssr: true` behavior — v2 is SSR by default; no explicit flag needed. Confirm.

### 2.3 Scripts (`package.json`)

```jsonc
"scripts": {
  "dev": "vite dev",
  "build": "tsgo --noEmit && vite build",   // keep the typecheck gate
  "start": "vite preview",
  "preview": "pnpm run build && npx wrangler dev",   // verify output path still right
  "deploy": "pnpm run build && wrangler deploy",
  // version: drop "vinxi version" or replace with a plain echo
}
```

### 2.4 `tsconfig.json` — `types`

Replace `vinxi/types/client` with `@solidjs/start/env`. Leave `paths` (`@/*`,`~/*`) as-is.

```jsonc
"types": ["./src/types/global.d.ts", "@solidjs/start/env"]
```

### 2.5 Server runtime helpers

- `vinxi/http` imports → `@solidjs/start/http`. **None exist in this repo** → no-op (re-grep to confirm post-merge).
- Middleware: none today. If one is added later, use the new H3 middleware syntax.

### 2.6 Cloudflare wiring

- Update `wrangler.jsonc` `main` + assets/output paths to Nitro v2's output dir (from spike).
- Re-test `globPatterns` and SW scope against the new build layout.

---

## 3. Validation gates (must all pass before merge)

1. `pnpm dev` — app boots, hot reload works.
2. `pnpm build` — `tsgo --noEmit` clean + Vite build succeeds.
3. Cloudflare: `wrangler dev` serves the built output; SSR responds.
4. PWA: manifest served, service worker registers, offline fallback (`/offline`) works.
5. Auth flow (token storage/refresh) works.
6. **Streaming itinerary** end-to-end (skeleton → enrichment → done) — the feature we just built.
7. Tailwind v4 styles + the editorial token themes render across `classic/modern/loci/dark`.
8. `oxlint .` clean.

## 4. Rollback

- All work on `chore/solidstart-v2`; `main` stays on Vinxi v1.
- Tag pre-migration commit. If alpha blocks deploy, abandon branch — zero prod impact.
- Keep `app.config.ts` in git history for fast revert of config.

## 5. Recommendation

Proceed **only through the spike first** (Section 1). v2 is alpha and the Cloudflare-preset-under-Nitro-v2
path is undocumented in the guide — that single unknown decides feasibility. If the spike
deploys to Workers, the rest is a ~1-file config port with no app-code changes.

---

## 6. SPIKE RESULTS (2026-06-03, branch `chore/solidstart-v2-spike`, isolated git worktree)

Ran the real install + `vite build` on `@solidjs/start@2.0.0-alpha.2`, `@solidjs/vite-plugin-nitro-2@0.2.0`, `vite@7.3.5`.

**✅ #1 risk RESOLVED — Cloudflare preset works under Nitro v2 plugin.**
`nitroV2Plugin({ preset: "cloudflare_module", compatibilityDate: "2025-06-12" })`
was accepted: build logged `[nitro] Building Nitro Server (preset: cloudflare-module,
compatibility date: 2025-06-12)`. (`NITRO_PRESET` env also set as belt-and-suspenders.)

**✅ Output layout identical to v1 → `wrangler.jsonc` needs ZERO changes.**
Produced `.output/server/index.mjs` + `.output/public`, exactly what `wrangler.jsonc`
already references (`main: ./.output/server/index.mjs`, `assets.directory: ./.output/public`).
Nitro even printed: `wrangler deploy .output/server/index.mjs --assets .output/public`.

**✅ Build green** — exit 0, client+SSR in 4.49s, Tailwind v4 plugin fine, no deprecations.
Only a benign chunk-size warning (`entry-server.js` 529 kB — pre-existing).

**⚠️ PWA partially works (Risk #2 confirmed).** `manifest.webmanifest` + `manifest.json`
generated and `workbox-window` bundled, **but `sw.js` (the service worker) was NOT emitted**.
`vite-plugin-pwa@1.2` under the v2 multi-environment build only ran partway. Action for
real migration: pin the PWA plugin to the **client** environment / verify `strategies`+
`registerType`, or bump the plugin; re-confirm SW registration + `/offline` fallback.

**⚠️ `@buf` lockfile integrity (pre-existing, surfaced).** pnpm 11 refuses the buf.build
BSR tarball for `@buf/loci_loci-proto.bufbuild_es` — "lockfile entry has no integrity field".
Had to delete `pnpm-lock.yaml` and fresh-resolve. The real migration must **regenerate the
lockfile** (or pin integrity) regardless of v2. Unrelated to SolidStart.

**🔴 RUNTIME BLOCKER — SSR 500s in workerd.** `wrangler dev .output/server/index.mjs
--assets .output/public --local` booted ("Ready on http://localhost:8799") and **static
assets serve** (`/manifest.webmanifest` → 200). But **every SSR route 500s**:
`TypeError: Illegal invocation: function called with incorrect 'this' reference` thrown in
Nitro's `sendWebResponse` (`.output/server/chunks/nitro/nitro.mjs`). A detached/unbound web
API call in the response path — an alpha-stage **Nitro v2 ↔ workerd compat bug**, consistent
with the build-time warnings about `@cloudflare/unenv-preset` and the `cloudflare:workers`
import. Not our app config.

**Diagnostic (spike pass 2): the bug is Cloudflare/workerd-specific, NOT SolidStart v2 SSR.**
Rebuilt the same v2 stack with the **`node-server`** preset and ran `node .output/server/index.mjs`:
`GET /` → **HTTP 200**, full SSR HTML (`<!DOCTYPE html>`, `data-theme`, `id="app"`). So
v2 server rendering works; the `Illegal invocation` is in the **workerd/unenv Cloudflare
response path** (`@solidjs/vite-plugin-nitro-2` + `@cloudflare/unenv-preset` + workerd),
not in SolidStart itself. (`/settings` hung on node — app-level SSR data-fetch to the absent
backend, unrelated to the framework.)

Things to try when revisiting (do NOT rabbit-hole on alpha now):

- This is a Cloudflare-adapter bug → watch `@solidjs/vite-plugin-nitro-2` + nitro + `unenv`
  releases specifically; pin `unenv`/`@cloudflare/unenv-preset`/`workerd`/`wrangler` to a
  combination the nitro-2 alpha was tested against.
- Bump to a newer `@solidjs/start@2.0.0-alpha.x` / `@solidjs/vite-plugin-nitro-2` once published.
- Align `wrangler` / `workerd` / `unenv` / `@cloudflare/unenv-preset` versions to what the
  nitro-2 alpha expects (mismatch is the likely trigger).
- Search/track upstream issues for "Illegal invocation sendWebResponse" on Nitro v2 + Workers.

**❓ Still untested (blocked by the 500):** app boot, streaming-itinerary at runtime, dev HMR.

**Verdict: NOT production-ready yet — do not migrate now.** Build tooling + Cloudflare
preset + deploy wiring all work (great signs), but v2 alpha **does not serve SSR on workerd**
in this version combo. Hold migration until a newer alpha clears the `sendWebResponse`
runtime error. Re-run this exact spike (build + `wrangler dev` probe) to re-test — it's the
gating check. Until then, stay on v1 (Vinxi).

---

### Sources

- [Migrating from v1 — SolidStart docs](https://docs.solidjs.com/solid-start/migrating-from-v1)
- [Roadmap: Start v2 & Ecosystem (discussion #2119)](https://github.com/solidjs/solid-start/discussions/2119)
- [DeVinxi roadmap (discussion #1960)](https://github.com/solidjs/solid-start/discussions/1960)

---

## 7. MIGRATION (2026-09-10, branch `chore/solidstart-v2`)

Versions: `@solidjs/start@2.0.4` (stable, GA 2026-08-04), `vite@8.3.0`,
`nitro@3.0.260903-beta` (Nitro v3 is still a beta tag — the only non-stable piece),
`@solidjs/router@1.0.0` (declared non-breaking realignment of 0.16), Node `>=24`.

**✅ Gate passed — the June blocker is gone.** `pnpm build` then plain `npx wrangler dev`
(not `wrangler dev <script>`; see below): `GET /` → 200 with full SSR HTML in workerd,
plus `/about`, `/trips`, `/offline`, `/sw.js`, `/manifest.webmanifest`, `/_build/assets/*`
all 200. No `Illegal invocation`. `wrangler deploy --dry-run` accepts the build
(6.4 MB / 1.4 MB gz, 189 modules + 263 assets). `vite dev` boots and SSRs. `tsgo`,
`oxlint`, `vitest` unchanged versus `main` (the 6 `auth-events.test.ts` failures are
pre-existing: `localStorage` is undefined under the `node` test environment).

What actually changed (six files + one new):

- `package.json` — drop `vinxi`, `nitropack`; add `vite`, `nitro`; scripts `vite dev|build|preview`; `engines.node >=24`.
- `app.config.ts` → `vite.config.ts` — `solidStart({ middleware })` + `nitro()`; `nitro: { preset: "cloudflare_module", compatibilityDate }` at top level. The `ensureHtmlShell` hack was **not** needed.
- `src/entry-server.tsx` — v2 `createHandler` returns an H3 app (`StartHandler`), and the dev server calls `serverEntry.default.fetch(req)`, so the v1 `instrumentedRequestHandler(event)` wrapper cannot exist. PostHog request metrics moved to **`src/middleware/index.ts`** (`createMiddleware([async (event, next) => …])`).
- `tsconfig.json` — `vinxi/types/client` → `@solidjs/start/env`.
- `wrangler.jsonc` — **trailing commas removed.** Nitro v3 reads it with a strict JSONC parser (comments OK, trailing commas fatal) to generate `.output/server/wrangler.json`.
- `.github/workflows/*.yml` — `NODE_VERSION` 22 → 24.

Gotchas found on the way:

- **PWA under the multi-environment build.** `vite-plugin-pwa` reads the root `build.outDir` (`dist`) and runs once per environment (client, ssr, nitro) — the June "no `sw.js`" symptom. Fix in `vite.config.ts`: `outDir: ".output/public"` (Nitro sets the client env's outDir there) and wrap the returned plugins with `applyToEnvironment: env => env.name === "client"`. Result: 224 precache entries, `sw.js` in `.output/public`.
- **Client assets still live under `/_build/assets/`**, so the map-chunk `runtimeCaching` pattern is unchanged.
- **Wrangler invocation.** `wrangler dev .output/server/index.mjs --assets …` now errors ("Found both a user configuration file … and a deploy configuration file … do not share the same base path") because Nitro writes `.wrangler/deploy/config.json` redirecting to `.output/server/wrangler.json`. Use plain `wrangler dev` / `wrangler deploy` from the project root, which is what the `preview`/`deploy` scripts already do.
- Nitro warns `Wrangler config main/assets is overridden and will be ignored` — expected; it rewrites those two keys relative to `.output/server`. The `env`-block prohibition documented in `wrangler.jsonc` still applies.
- No SSR-only code (`renderToString`, `ssrElement`) in the client bundle, so the `isServer` export-condition bug noted in `src/lib/api/authed-query.ts` is not reproduced by this preset. The runtime `typeof window` guard stays anyway.

Two more found by driving headless Chrome (DevTools protocol) against `wrangler dev`:

- **Duplicate `solid-js` broke hydration.** `@solidjs/start@2` depends on `solid-js ^1.9.15`
  while the app pinned `^1.9.14`, so pnpm installed both. SSR rendered fine, but the client
  threw `Cannot read properties of null (reading 'push')` inside `solid-js/web`, then every
  context lookup failed (`useAuth must be used within an AuthProvider`, `<MetaProvider />
should be in the tree`, `No QueryClient set`) and links did full reloads. Fix: `solid-js`
  → `^1.9.15` so the lockfile holds one copy. Check `grep '^  solid-js@' pnpm-lock.yaml`
  after any future `@solidjs/start` bump.
- **`posthog-node` autocapture 500s on workerd.** `enableExceptionAutocapture: true` calls
  `process.on`, which does not exist in the Workers runtime, so constructing the client
  threw and every SSR request 500'd. CI never sets `VITE_POSTHOG_*`, so production never
  hit it; local builds with `.env` did. Now `false`, with `posthog.captureException(error)`
  in the middleware's catch.

Browser-verified (headless Chrome, production build under `wrangler dev`): `/`, `/about`,
`/trips` hydrate with zero console errors, `<title>` set via MetaProvider, service worker
registered and `activated`, in-app link clicks are client-side navigations (no reload).

Still not verified: signed-in `/trips` and the streaming itinerary (need the backend). Do
those on the staging worker before merging.
