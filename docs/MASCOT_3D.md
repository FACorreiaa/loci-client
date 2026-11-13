# 3D mascot — how it is built and gated (BRD-001)

Beta-only experiment. Rules: `DESIGN.md` → Visual language. Status and **Done when**: `BACKLOG.md` → BRD-001.

## Pieces

| Piece | Where | Notes |
|---|---|---|
| Model build | `tools/brand/mascot_3d.py` | Stdlib Python. Reads the owner's source GLBs, writes `mascot.glb`, `Mascot.usdz`, `mascot-rig.json` to `tools/brand/out/mascot-3d/` (git-ignored). Rerunnable. |
| Motion data | `design/mascot-motion.json` | Canonical. Tracks, blink, look-at. Values are offsets from the rest pose. |
| Shared fixtures | `design/mascot-motion.fixtures.json` | `{fn, args, expect}` cases. Both clients' tests iterate this file, so they assert the same numbers by construction. |
| Copies | `src/lib/mascot3d/*.json`, `loci-ios/loci/loci/Resources/Mascot3D/*.json` | `scripts/brand-guard.sh` (here) and `scripts/mascot-motion-guard.sh` (iOS) fail CI on drift. Fix with `cp design/<file> <copy>`. |
| Pure driver | `src/lib/mascot-motion.ts`, iOS `Core/Theme/MascotMotion.swift` | Time in, values out. No renderer import. Rotation order YXZ on both. |
| Renderer | `src/lib/mascot3d/scene.ts` | **The only module that imports `three`** (guarded). Also hosts the older 2.5D plane used by `MascotScene`. |
| Component | `src/components/brand/Mascot3D.tsx` | Still first, canvas swaps in after its first drawn frame. |

## Web gating

- One build-time variable: `VITE_MASCOT_3D_URL`. Empty means off: Vite inlines `""`, the dynamic import is dead code, and the production bundle carries no 3D chunk.
- It is set only by `.github/workflows/deploy-beta.yml` (Worker `loci-client-beta`, `beta.lociai.fyi`). The production workflows never set it.
- Local: copy `tools/brand/out/mascot-3d/mascot.glb` to `public/mascot3d/` (git-ignored) and run `VITE_MASCOT_3D_URL=/mascot3d/mascot.glb pnpm dev`.
- The still stays when: server render, empty URL, `prefers-reduced-motion`, `navigator.connection.saveData`, no WebGL, the model fails to load, or the context is lost.
- Off-screen (IntersectionObserver) or hidden tab pauses the loop; paused time is not replayed.
- One WebGL context per page. On the landing the slot renders either `Mascot3D` or the 2.5D `MascotScene`, never both. The sign-in aside mounts only at ≥1024px, where the aside is visible.
- Lights read `--lantern` and `--holo` from the computed style of a `.loci-hero` element (dark values), not hex literals.

## Size

`pnpm size` (`scripts/size-budget.mjs`, `size-budget.json`) gates every route's own JS (gzip of entry plus its static imports) and the total including lazy chunks. BRD-001 may grow only the total.

## CDN

`tools/brand/cdn/` is the static assets Worker `loci-cdn` on `cdn.lociai.fyi`, copied from Aaru's `docs/brand/cdn`. A new cut of the model is a new path (`/loci/mascot3d/v1/`, `v2/` …), never an overwrite: files are cached a year as immutable. Every deploy replaces the whole file set, so keep old versions in `tools/brand/out/cdn/` while anything points at them. Deployed by hand; see the README there.

## Beta web Worker

`wrangler.jsonc` can't carry an `env` block (Nitro copies it into `.output/server/wrangler.json`, and Workers Builds rejects the copy). The beta workflow builds normally, then rewrites `name` and `routes` in `.output/server/wrangler.json` and deploys that file. It is not connected to Workers Builds. `deploy-staging.yml` is older, targets a `staging` env that does not exist, and is left alone.

Signing in on beta needs `beta.lociai.fyi` allowed as an origin by the API and the auth provider. That is not needed to judge the mascot and is not done.
