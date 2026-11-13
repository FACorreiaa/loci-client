# Loci 3D mascot — beta-only experiment (web + iOS)

## Context
Owner wants the existing Loci mascot (not a redesign) as a real-time 3D asset, judged on a device before any production exposure. Shape copied from Aaru BRD-011 (owl), adapted to Loci's repos, which differ:
- Loci is **3 separate repos** (loci-client, loci-ios, infra), no monorepo, no `design/` folder, no BACKLOG.md.
- **No beta web deployment exists** (`deploy-staging.yml` targets a nonexistent `--env staging`; `wrangler.jsonc:40-46` forbids `env` blocks because Nitro copies the file into `.output/server/wrangler.json`).
- three.js **already installed** (`^0.185.1`, caret) with one consumer: `src/components/brand/MascotScene.tsx` (2.5D plane, landing "Your guide", lazy, IO + visibility pause, teardown pattern at l.62-85).
- iOS has a **Beta config** (`com.fernandocorreia.loci.beta`, nightly internal TestFlight via `fastlane beta`) but no `BETA` compile flag, no xcconfig, no `EXCLUDED_SOURCE_FILE_NAMES`, no RealityKit, no Low Power handling, no Mac target. iOS 26.2 / Swift 6.
- No hex-literal guard, no bundle budget on either side.
- Flag (per global rule): supply-side polish, strangers-count 0.

**Decisions taken (owner, 2026-11-13):** product = Loci; asset = the mascot (character motion allowed); web: landing "Your guide" **and** sign-in aside; iOS: LoginScreen, mascot **above** a smaller lockup; motion: idle breath + eyes/body follow + blink + amber ring pulse; web model on a **static CDN Worker** (`cdn.lociai.fyi`, Aaru `docs/brand/cdn` pattern).

**Assets inspected (header only, read-only):**
- `Loci_Solid_Sculpt_Hero.glb` — 6.2 MB, 312k tris, 127 named meshes, Y-up, origin at feet (Y 0.31→3.22, X off-centre −1.05→1.19). Separate `Left/Right_Eye_{Bronze_Eyelid,Glossy_DeepBrown,Amber_Lower_Reflect,Main_Catchlight,Secondary_Catchlight}`, `Loci_Small_Curved_Smile`, backpack, `NavModule_{1,2,3}_{Amber_Ring,Core,…}`. **No head joint** (one-piece body), no skin/morphs/clips/textures. 18 materials (`coral, iris_amber, glow, glow_pale, …`).
- `Loci_Solid_Web.glb` — 1.6 MB, 67k tris, 18 meshes batched by material → eyes merged, cannot animate per eye as-is.
- `LociSolid.usdz` — one uncompressed text `.usda`, no joint grouping. Reference only; iOS uses the script's output.

## Shared design: motion as data
- Canonical: `loci-client/design/mascot-motion.json` + `loci-client/design/mascot-motion.fixtures.json` (DESIGN.md lives in loci-client and is already the iOS design source per IOS-GUIDELINES).
- Schema = Aaru's (`version, states.<name>.tracks[{joint|material, property, periodSeconds, easing, keyframes[{t,v}]}], blink, lookAt`) with `lookAt` adapted: `bodyYawDegrees ≤10, bodyPitchDegrees ≤5, eyeOffset, timeConstantSeconds` (no head). One state `standing` (breath `translateY` on `Body` 4 s ≈ DESIGN.md mascot bob; ring `emissiveScale` on material `glow`). Entrance: short rise+fade 320 ms (`--motion-slow`/screen token) as a one-shot track.
- **Fixtures are data, not hand-copied numbers:** `fixtures.json` = list of `{fn, args, expect}`; both test suites iterate it → identical assertions by construction.
- Copies: `loci-client/src/lib/mascot3d/{mascot-motion,mascot-motion.fixtures,mascot-rig}.json`, `loci-ios/loci/loci/Resources/Mascot3D/` same three.
- Drift guard:
  - loci-client `scripts/brand-guard.sh`: `cmp` design/ vs src copies; also fails on hex/`rgb(` literals **inside `src/lib/mascot3d/` and `Mascot3D.tsx`** only (no repo-wide sweep — out of scope). CI step in `ci.yml`, no path filter.
  - loci-ios `scripts/mascot-motion-guard.sh`: CI sparse-checks-out `FACorreiaa/loci-client` `design/` (secret `LOCI_CLIENT_READ_TOKEN`, owner creates; job fails loudly if missing) and `cmp`s. Plus `scripts/sync-mascot-motion.sh` for local copy.

## Model build script (first step that touches the files)
`loci-client/tools/brand/mascot_3d.py` (stdlib only, next to existing `matte-mascot.py`), outputs to `tools/brand/out/mascot-3d/` (git-ignored, add to `.gitignore`):
- Inputs `--hero <glb> [--web <glb>] --out <dir>`. Sources copied first into a new empty dir `…/scratchpad/mascot-src/`; run from repo root as `python3 -I tools/brand/mascot_3d.py --hero <abs> --web <abs> --out tools/brand/out/mascot-3d` (never cwd in the source dir).
- Joints: `Root › Mascot › Body, EyeL, EyeR, LidL, LidR, Rings` (grouped by hero node-name prefix). Geometry: start from the 67k web GLB and split its batched meshes by hero eye/lid/ring bounding boxes (triangle-centroid test); if that proves lossy, decimate is out of stdlib → stop and report, do not invent geometry. Recentre X, keep feet at origin, scale to 1 unit tall; merge same-material meshes within a joint; add normals if absent; `KHR_mesh_quantization`.
- Emits `mascot.glb` (web), `Mascot.usdz` (`.usda` → `/usr/bin/usdcat` → `usdzip`, as Aaru), `mascot-rig.json` (pivots for eyes/lids from hero bounds, lid rest/shut scale, ring material names, camera framing, poster pose matching `mascot.webp`).
- Prints KB / draw calls / tris. Targets: GLB ≤ 1 MB, ≤ 30 draw calls, ≤ 80k tris; misses get reported, not hidden.
- **Checkpoint:** show owner the report + a still render before wiring clients.

## Steps (docs before code; each repo on its own branch/worktree, explicit staging)

### 0. Docs (loci-client + loci-ios)
1. `loci-client/DESIGN.md` mascot section (l.20 area): exception — 3D mascot on landing "Your guide" + sign-in aside (beta web) and LoginScreen (iOS Beta) until owner verdict; lights from `--lantern`/`--holo`; motion from `design/mascot-motion.json`; reduced-motion/Save-Data/Low-Power keep the still.
2. New `loci-client/BACKLOG.md` with **BRD-001 3D mascot (beta)** — *Done when:* 3D mascot renders on beta.lociai.fyi landing + sign-in aside and in a Loci Beta TestFlight LoginScreen on iPhone; production web bundle contains no mascot3d chunk and no model URL; Release .app proof passes (no `.usdz`, no `Mascot3DView` symbol) with Beta as positive control; route budgets unchanged; owner go/no-go recorded here with measurements (GLB KB, draw calls, tris, lazy gzip, first-frame ms on device). Pointer from `loci-ios/docs/ios/ROADMAP.md`.
3. Architecture: new `loci-client/docs/MASCOT_3D.md` (gating, single three module, CDN versioning, beta Worker); `loci-ios/docs/ios/ARCHITECTURE.md` §3 (BETA flag + Release exclusion) and §12 decision entry. Plan copy at `loci-client/docs/superpowers/plans/2026-11-13-mascot-3d-experiment.md`.

### 1. Guards first (loci-client), separate commit before feature
- Pin `three` and `@types/three` to the exact lockfile-resolved version (0.185.x, no caret).
- `scripts/size-budget.mjs` + `size-budget.json`: per-route = gzip of entry + route's static imports from the Vite client manifest (path under `.output/public` to confirm on first build); `totalJs` = all client `.js` (includes lazy). `pnpm size` / `--update` (3% headroom). Seed on current main, add to `ci.yml`.
- Guard: `from "three"` / `three/addons` allowed only in `src/lib/mascot3d/scene.ts` (grep in brand-guard).

### 2. Web (loci-client)
- `src/lib/mascot-motion.ts` — pure driver (`sampleTrack, ease, blinkScale, blinkSeconds, blinkWait, lookToward, approach`, rotation order YXZ). `src/lib/mascot-motion.test.ts` runs fixtures.json.
- `src/lib/mascot3d/scene.ts` — **only three importer**: `mountModel(canvas, url, rig, motion, onFirstFrame)` (GLTFLoader, RoomEnvironment ~0.55, alpha, low-power, DPR ≤2, ACES; lights `new Color().setStyle(hsl(var(--lantern)/--holo))` read via `getComputedStyle`) **and** `mountPlane(...)` = existing MascotScene 2.5D code moved here, so MascotScene imports scene.ts not three.
- `src/components/brand/Mascot3D.tsx` — flat `mascot.webp` `<img>` first paint (SSR) + canvas stacked, swap on first frame (opacity `--motion-slow`). Bail to still when: `import.meta.env.SSR`, URL empty, reduced motion (`prefersReducedMotion` from `~/lib/hooks/useInView`), `navigator.connection?.saveData`, no WebGL, load throws. IO (reuse `useInView`) + `visibilitychange` pause; webglcontextlost → still; teardown variable pattern (onCleanup before await, as MascotScene l.62-65). Canvas `aria-hidden`; still keeps alt.
- Gating: **`VITE_MASCOT_3D_URL`** (build-time). Empty → Vite inlines `""` → dynamic import is dead code, prod has no 3D chunk. Never set in prod workflows.
- Mounts: `PublicLandingPage.tsx` l.261-271 → `<Show when={URL} fallback={<MascotScene/>}><Mascot3D/></Show>` (one context either way). `layout/Auth.tsx` aside l.22-24 → `Mascot3D` above lockup, mounted only when `matchMedia('(min-width: 1024px)')` (aside is desktop-only; no hidden context on phones).
- Local: `tools/brand/out/mascot-3d/mascot.glb` → `public/mascot3d/` (git-ignored), `VITE_MASCOT_3D_URL=/mascot3d/mascot.glb pnpm dev`.

### 3. CDN + beta web
- `loci-client/tools/brand/cdn/{wrangler.jsonc,_headers,README.md}` — Worker `loci-cdn`, assets-only, custom domain `cdn.lociai.fyi`, `workers_dev:false`; `_headers` `/loci/*` → `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=31536000, immutable`, `nosniff`. Path `/loci/mascot3d/v1/mascot.glb`; new cut = new path. Deploy by hand (`wrangler deploy --config tools/brand/cdn/wrangler.jsonc`), owner approves.
- Beta Worker `loci-client-beta` on `beta.lociai.fyi`: **spike first** — build normally, then rewrite `.output/server/wrangler.json` `name`/`routes` (jq) and `wrangler deploy --config` that file. New `.github/workflows/deploy-beta.yml` (manual dispatch + push to main) with `VITE_MASCOT_3D_URL=https://cdn.lociai.fyi/loci/mascot3d/v1/mascot.glb`, same other VITE_* as prod, not connected to Workers Builds. Leave broken `deploy-staging.yml` untouched (note in MASCOT_3D.md).
- Sign-in on beta actually working needs CORS/OAuth redirect for `beta.lociai.fyi` (API + Supabase) — not required to judge the mascot; listed as optional follow-up, infra repo if done.

### 4. iOS (loci-ios)
- pbxproj: Beta config `SWIFT_ACTIVE_COMPILATION_CONDITIONS = "BETA $(inherited)"` (project + app target); app **and** lociTests Release: `EXCLUDED_SOURCE_FILE_NAMES = Mascot3DView.swift MascotMotion.swift MascotMotionTests.swift Mascot.usdz mascot-motion.json mascot-motion.fixtures.json mascot-rig.json` (works: synchronized folders).
- `loci/loci/Core/Theme/MascotMotion.swift` (Decodable/Sendable, same arithmetic), `Mascot3DView.swift`: `RealityView`, `content.camera = .virtual`, clear bg, `Entity(named:"Mascot", in:.main)` → start at `findEntity(named:"Root")` (Aaru: USDZ adds wrapper), `SceneEvents.Update` drives tracks, glow via mesh-name suffix `_glow`; lights `DirectionalLightComponent` from `LociTheme` tokens (no new literals). Still = existing `LociMascot` image until first frame; stays under `accessibilityReduceMotion` or `ProcessInfo.isLowPowerModeEnabled` (+ `powerStateDidChange` observer); load failure → still. Follow: `onContinuousHover` + `DragGesture(minimumDistance:0)` on the mascot frame only (form fields untouched), else slow gaze wander.
- `LoginScreen.swift:56`: `#if DEBUG || BETA` → `Mascot3DView` above lockup (lockup shrunk); `#else` → lockup as today.
- `lociTests/MascotMotionTests.swift` (Swift Testing) iterates fixtures.json.
- `scripts/verify-release-no-mascot3d.sh`: `xcodebuild -scheme loci -configuration Release -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build`, then fail if `.app` contains `*.usdz` or `mascot-*.json`, or `strings`/`nm` on the binary finds `Mascot3DView`/`MascotMotion`; **same script on Beta must find them** (negative control so the check can't pass vacuously). CI job in `ci.yml` (paths filter on Theme/, Resources/Mascot3D/, pbxproj).
- No Mac target; note in ARCHITECTURE whether "Designed for iPad on Mac" is enabled in ASC — if yes, the Beta build's RealityView runs there unchanged.
- Rules: SwiftLint `--strict` incl. tests; never swift-format tracked files; worktree test setup per memory (proto symlink, DerivedData outside, booted sim).

## Verification
- Script: rerun twice → byte-identical outputs; report KB/draw calls/tris; still render compared to `mascot.webp`.
- Web: `pnpm test` (fixtures), `pnpm size` (routes unchanged, only totalJs grows), `oxlint --deny-warnings`, `tsgo`, brand-guard. Prod-shaped build with empty var: grep `.output` for `GLTFLoader`/`mascot3d` chunk → none. Browser QA on beta.lociai.fyi (landing + sign-in): first-frame swap, pointer follow, blink, ring pulse, IO pause (scroll away, `requestAnimationFrame` stops), hidden tab, reduced-motion emulation, Save-Data, WebGL disabled, bad URL → still; exactly one `webglcontext` per page; no CLS. Grep live prod bundle for `cdn.lociai.fyi` → absent.
- iOS: `fastlane test`, SwiftLint strict, guard script, `verify-release-no-mascot3d.sh` (Release clean, Beta positive). Sim: LoginScreen first frame, Reduce Motion + Low Power toggles keep still. Then nightly Loci Beta TestFlight → owner judges on device.
- Owner verdict written into BRD-001 with measurements.

## Owner-owed
`LOCI_CLIENT_READ_TOKEN` secret (iOS drift guard); approve CDN Worker + beta Worker deploys (DNS on lociai.fyi); device verdict.
