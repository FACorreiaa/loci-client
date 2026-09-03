# Loci web — UI, performance and restyle audit (2026-09-03)

Scope: `loci-client` at `21bc7d4` (SolidStart 1.3 / Vinxi 0.5 / Solid 1.9 / Tailwind 4 / Kobalte + shadcn-solid kit / Mapbox GL 3 / TanStack Query / Connect-Web). Companion to `DESIGN.md` (web design SSOT) and `docs/NATIVE_DESIGN.md` (native parity).

## Verdict

`DESIGN.md` is a finished, distinctive system: parchment ground, forest ink, sage secondary, terracotta accent; Fraunces for destination headlines, DM Sans for UI, Space Mono for coordinates and labels; flat 1 px surfaces, no glass stacks, motion tokens with reduced-motion fallbacks, and an explicit anti-pattern list. The landing page (`components/features/Home/landing/*`, `PublicLandingPage.tsx`) already executes it and holds Lighthouse 100 on `/`.

**The restyle is therefore an enforcement pass, not a new direction.** What drifts is the *product* surface behind sign-in: generic shadcn/zinc defaults, inconsistent card radius and borders, leftover alternate themes, orphaned components, and files too large to review. Do not invent a second visual language; make every route look like the landing page already does.

## Findings, ranked

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| 1 | High | `.github/workflows/ci.yml` | Lint ran with `\|\| true`; no test job although 11 vitest suites (177 tests) exist. Nothing could fail CI. | **Fixed 2026-09-03** — lint errors fail, `pnpm test` job added, `"test": "vitest run"` script added. 44 lint *warnings* remain (unused `useQuery` imports in `src/lib/api/*.ts`, unassigned refs). Clear them, then set `--deny-warnings`. |
| 2 | High | `src/routes/index.tsx` | JSON-LD `SoftwareApplication` carried a fabricated `aggregateRating` 4.8 / 1250. | **Fixed 2026-09-03** — removed. Re-add only with real review data. |
| 3 | High | `eslint.config.js` | `solid/reactivity` is `off`. This is the rule that catches destructured props/signals losing reactivity — the most common Solid bug class — and the app has four 700–1200-line stateful files. | Open. Enable as `warn`, fix, then `error`. |
| 4 | Med | `src/lib/hooks/useChatSession.ts` (1212 lines), `components/features/Settings/TravelProfiles.tsx` (1202), `routes/discover.tsx` (986), `routes/settings/index.tsx` (874), `routes/profiles/index.tsx` (751), `routes/recents/[city].tsx` (707), `routes/profile.tsx` (671), `components/features/Dashboard/LoggedInDashboard.tsx` (632) | Too large to review or restyle safely; 63 `createEffect` sites concentrated here. | Open — phase 2 below. |
| 5 | Med | `src/lib/streaming/chatStream.ts` vs Connect server-streaming everywhere else | Two real-time transports (SSE `EventSource` for chat, Connect streams elsewhere) → two error models, two reconnect paths. | Open. Server `StreamChat` is already a Connect server-stream with resume tokens; migrate the client to it and delete the SSE path. |
| 6 | Med | `src/components/features/Home/{Hero,ContentGrid,CTA,MobileAppAnnouncement,RealTimeStats,Statistics,Stats,Trending}.tsx` | Eight orphaned components (~35 KB), never imported; the only consumer of the `solid-icons` dependency. | Open — delete files and drop `solid-icons` (keep `lucide-solid`). |
| 7 | Med | `src/styles/base.css`, `themes.css` | `data-theme="classic"` / `"modern"` rulesets (Playfair/Lato, Plus Jakarta/Inter) still shipped although `DESIGN.md` says the single brand system is `loci`. | Open — delete; keeps CSS surface honest before restyling. |
| 8 | Med | — | No product analytics at all; GO-TO-MARKET §2a #2/#3 blocks launch on this. | Open — phase 4. |
| 9 | Low | `components.json` | shadcn-solid `baseColor: "zinc"`; new kit components will scaffold off-palette. | Open — set to `neutral` and ensure generated components read tokens, not zinc classes. |
| 10 | Low | `ReviewCard.tsx:96`, `ReviewForm.tsx:301`, `Settings/TwoFactor.tsx:239`, `itinerary/ProgressiveImage.tsx:106`, `routes/roadmap.tsx:245`, `routes/settings/index.tsx:264` | `<img>` without `alt`. | Open — add `alt` (empty string when decorative) + `loading="lazy"` where below the fold. |
| 11 | Low | `public/images/logo.png` (302 KB) | Unused legacy asset beside the 30 KB `loci.png` actually referenced. | Open — delete after grep confirms no reference. |
| 12 | Low | `src/routes/_archive/near.tsx.bak`, `README.md:27` | Dead route file in `routes/`; README still contains an AI-generation preamble line and `create-solid` boilerplate above the real content. | Open — delete / rewrite. |
| 13 | Low | `.oxlintrc.json` = `{}` | Primary linter runs with defaults only. | Open — add the Solid plugin rules once #3 is done. |
| 14 | Low | `src/routes/discover.tsx:57` | `localResultCache` `Map` created inside the component body; recreated per mount. | Open — hoist to module scope or `createMemo` once #4 splits the file. |
| 15 | Info | `src/lib/connect-transport.ts` | Positive: single-flight refresh on `Unauthenticated`, retry-once, documented past bugs. Reuse this exact pattern in the iOS client. | — |

## Performance plan (SolidStart v1, no framework migration)

Keep what is right: Mapbox is lazy-loaded (`lazy()` in 14 files) and excluded from the PWA precache (`app.config.ts` `manifestTransforms`); the second landing globe is pure SVG on purpose.

1. **Effects audit** in the four largest files: every `createEffect` that only derives data becomes `createMemo`; effects that fetch move to `createResource`/TanStack Query. Expect most of the 63 sites to go.
2. **Route-level code split** for `globe`, `admin`, `compare`, `preview/*`: wrap the route default export in `lazy()`.
3. **Images**: `alt` + `loading="lazy"` + explicit `width`/`height` on POI cards to stop CLS.
4. **Lighthouse CI**: `lighthouserc.cjs` already runs `/`; add `/discover`, `/pricing`, `/chat`, `/trips/[id]` with a real seeded trip in staging. Budget: perf ≥ 90 on product routes, 100 on marketing routes.
5. **Bundle check**: after #6/#7 land, run `pnpm build` and compare `.output` chunk sizes; the goal is no chunk over 250 KB gz except Mapbox.

## Restyle spec (enforce `DESIGN.md`)

Tokens available in `src/styles/themes.css`: `--background --foreground --card --card-foreground --popover --primary --primary-foreground --secondary --muted --muted-foreground --accent --destructive --border --input --ring --radius --hero-gradient --hero-glow --hero-foreground --map-line --theme-color`. Utilities in `base.css`: `.loci-card`, `.island-panel`, hero chips; motion in `motion-tokens.css` (`resultArrive`, `selectionSettle`, `routeDraw`, `sheetPresent`, `press`).

Rules that apply to every page group below:

- Headlines that name a place or a journey use Fraunces; everything else DM Sans; coordinates, day numbers, route ids, status labels use Space Mono.
- Surfaces are `.loci-card` (1 px `--border`, `--radius`, no shadow) or `.island-panel` for floating map panels. No stacked `backdrop-blur`.
- Terracotta (`--accent`) is reserved for the primary action and map marks; never for decoration.
- Every interactive element ≥ 44 px on touch (already enforced globally), visible `:focus-visible`.
- Motion: only the named tokens; all wrapped in `@media (prefers-reduced-motion: no-preference)`.
- Dark mode check on every screen: the `.dark` palette flips to forest ground with sage/terracotta accents; verify contrast ≥ 4.5:1 for body text.

| Page group | Routes / components | What drifts today | Target |
|---|---|---|---|
| Landing | `index.tsx` → `PublicLandingPage`, `Home/landing/*` | On spec. Only the JSON-LD (fixed) and the "iOS/Android coming soon" `operatingSystem` string. | Keep. Re-check copy against the GO-TO-MARKET §3a one-liner (see `MARKETING-AUDIT-2026-09.md`). |
| Auth | `routes/auth/*`, `layout/Auth.tsx`, `features/Auth/*` | Generic centered card, zinc-ish inputs, "Native iOS + Android coming soon" strip. | `.loci-card` on parchment, Fraunces headline ("Pick up where the chat left off"), DM Sans fields with `--input`/`--ring`, single terracotta CTA, remove the mobile strip until a date exists. |
| Discover / results | `routes/discover.tsx`, `components/results/*`, `filters/*`, `poi/*` | Mixed card radii, shadowed cards, blue-ish map defaults in places, skeletons not matching card geometry. | One `POICard` on `.loci-card`; Space Mono for distance/coords; map marks via `--map-line`/terracotta per `DESIGN.md` §Map language; `resultArrive` on list mount; skeletons share the card's exact box. |
| Chat | `routes/chat/index.tsx`, `components/chat/*`, `streaming/*` | Bubbles read like a generic assistant; error card (`StreamErrorCard`) off-palette; no field-note rhythm. | Follow `DESIGN.md` §Chat composition: assistant turns as field notes on parchment, user turns as muted-ink chips, itinerary blocks as `.loci-card` with day numbers in Space Mono; `selectionSettle` when a POI is picked. |
| Itinerary / trip | `routes/trips/[id].tsx`, `routes/itinerary.tsx`, `components/itinerary/*`, `trip/*` | Day headers inconsistent; legs and alerts panels use different borders; money panel added 2026-08 has its own style. | Day header = Fraunces + Space Mono day id; stops as compact rows in one card per day; legs drawn with `routeDraw`; alerts + money panels as `.island-panel` on the map, `.loci-card` off it. |
| Settings / profile | `routes/settings/*`, `routes/profile.tsx`, `routes/profiles/*`, `Settings/*` | Longest files, most shadcn defaults (tabs, switches, dialogs in zinc). | Split first (phase 2). Then: section headers DM Sans semibold, forms on `.loci-card`, destructive actions in `--destructive` only inside a confirm sheet (`sheetPresent`). |
| Pricing / about / features / roadmap | `routes/pricing.tsx` (531 lines), `about.tsx`, `features.tsx`, `roadmap.tsx` | Pricing is on-palette but long; about page copy ("Taste-Aware Travel OS", "Glass accessibility") predates the theme and contradicts the no-glass rule. | Pricing: extract `PlanCard`, `FeatureMatrix`; keep terracotta only on the Pro CTA. Rewrite about/features copy to the live-signals positioning; drop "glass" language. |
| Chrome | `app.tsx`, `Nav`, `Footer`, `PWAInstall`, `UpgradePrompt` | Fine; check `UpgradePrompt` uses `--accent` not a custom orange. | Keep. |

Kit clean-up that unblocks all rows: `components.json` → `neutral`; delete `classic`/`modern` theme CSS; delete the eight orphaned `Home/*` components and `solid-icons`; regenerate any `src/ui/*` primitive that still carries `zinc-*` classes.

## Follow-up implementation plan (separate approval)

**Phase 1 — cleanup (½ day).** Findings 3, 6, 7, 9, 10, 11, 12, 13. Clear the 44 lint warnings and turn on `--deny-warnings`. No visual change yet.

**Phase 2 — split the giants (1–2 days).** `useChatSession.ts` → session state / stream adapter / message reducers; `TravelProfiles.tsx` → list, editor, preference groups; `discover.tsx` → query state, results list, map panel; `settings/index.tsx` → one file per section. Snapshot the rendered DOM of each route before/after with vitest + `@solidjs/testing-library` so the split is behaviour-preserving.

**Phase 3 — restyle per page group (2–3 days).** Work the table top to bottom, one PR per row, each verified in the browser in light and dark mode and at 375 px width. Finish with Lighthouse on the five routes.

**Phase 4 — analytics (½ day).** PostHog (`posthog-js`) with the five GO-TO-MARKET metrics as events: `signup_completed`, `itinerary_finished`, `trip_reopened` (server-side, ≥ 24 h), `poi_saved`, `upgrade_clicked`; `BOOKING_OPENED` already exists server-side. Gate 1 of the launch plan.

**Phase 5 — single transport (1 day).** Replace `chatStream.ts` SSE with the Connect `StreamChat` server-stream + resume token; delete the SSE code path.

## Verification for this audit

```
pnpm typecheck && pnpm run lint && pnpm test && pnpm build
```
All four pass at `21bc7d4` (lint: 0 errors, 44 warnings; tests: 177 passed).
