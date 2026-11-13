# 3D mascot — how it is built and gated (BRD-001)

In production since 2026-11-13 (owner's call; planned as a beta-only experiment). Rules: `DESIGN.md` → Visual language. Status and **Done when**: `BACKLOG.md` → BRD-001. Plan: `docs/superpowers/plans/2026-11-13-mascot-3d-experiment.md`.

## Pieces

| Piece | Where | Notes |
|---|---|---|
| Model build | `tools/brand/mascot_3d.py` | Stdlib Python. The hero sculpt gives the eye boxes, the web sculpt gives every triangle. Writes `mascot.glb` (quantised), `Mascot.usdz` and `mascot-rig.json` to `tools/brand/out/mascot-3d/` (git-ignored). The GLB is byte-stable across reruns; the USDZ is not (`usdzip` stamps it). |
| Motion data | `design/mascot-motion.json` | Canonical. Breath, glow pulse, blink, look-at. Offsets from the rest pose, in mascot heights. |
| Rig | `design/mascot-rig.json` | Script output, formatted. After a rebuild: `cp tools/brand/out/mascot-3d/mascot-rig.json design/ && pnpm exec oxfmt --write design/mascot-rig.json`, then copy to the clients. |
| Shared fixtures | `design/mascot-motion.fixtures.json` | `{fn, args, expect}` cases computed once from the spec. Both clients' tests iterate this file. |
| Copies | `src/lib/mascot3d/*.json`, `loci-ios/loci/loci/Resources/Mascot3D/*.json` | `pnpm brand:guard` (here) and `scripts/mascot-motion-guard.sh` (iOS) fail CI on drift. Fix with `cp design/<file> <copy>`. |
| Pure driver | `src/lib/mascot-motion.ts`, iOS `Core/Theme/MascotMotion.swift` | Time in, values out. No renderer import. Rotation order YXZ on both. |
| Renderer | `src/lib/mascot3d/scene.ts` | **The only module that imports `three`** (`pnpm brand:guard`). Also hosts the older 2.5D plane used by `MascotScene`. |
| Component | `src/components/brand/Mascot3D.tsx`, loaded through `Mascot3DSlot.tsx` | Still first, canvas after its first drawn frame. |
| Still | `public/images/brand/mascot-3d-still{,-sm}.webp` | Rendered by `node tools/brand/mascot-still.mjs` with `scene.ts` itself at the rest pose (t = 0, look centred, eyes open), so the swap to the canvas changes nothing on screen. Rerun after every model cut or lighting change. |

## Web gating

- One build-time variable: `VITE_MASCOT_3D_URL`. Empty means off.
- The branches that decide whether 3D code ships (`Mascot3DSlot`, the landing and auth mounts, `loadAddons` in `scene.ts`) read `import.meta.env.VITE_MASCOT_3D_URL` directly. Vite inlines a literal there and the bundler deletes the dead branch; it does **not** fold a constant imported from another module, which left the component chunk in production when the flag lived in `flag.ts`.
- Measured on the production shape (variable unset): no glTF loader and no model URL in the client, and no `three` in the Worker at all. `main` bundled `three` into the Worker through MascotScene's dynamic import; the `import.meta.env.SSR` guard before each dynamic import fixes that. Every route is within 22 bytes gzip of `main` (the entry's map of lazy chunk names), and total JS is 54 KB smaller, because `scene.ts` uses named imports where MascotScene imported the whole `three` namespace.
- Production sets it in the committed `.env.production`, which `vite build` reads in every production build: the Actions deploy, Workers Builds and CI alike, so the two racing deploys ship the same thing. `vite dev` does not read it. `deploy-beta.yml` also sets it, for `beta.lociai.fyi`.
- To turn the 3D mascot off in production, empty the value in `.env.production`.
- Local: `cp tools/brand/out/mascot-3d/mascot.glb public/mascot3d/` (git-ignored) and `VITE_MASCOT_3D_URL=/mascot3d/mascot.glb pnpm dev`.
- The still stays when: server render, empty URL, `prefers-reduced-motion`, `navigator.connection.saveData`, no WebGL, the slot narrower than its `minWidth`, the model or chunk fails to load, or the context is lost.
- Off-screen (IntersectionObserver) or a hidden tab pauses the loop; paused time is not replayed.
- One WebGL context per page. The landing slot renders either `Mascot3D` or the 2.5D `MascotScene`, never both. The sign-in aside starts the mascot only at ≥1024px, where the aside is visible.
- The pointer is followed anywhere on the page, measured from the mascot's centre and scaled by the viewport, so the turn stays small.
- Lights read `--lantern` and `--holo` from a hidden `.loci-hero` probe, which always carries the dark-appearance (bright) values. No colour literals (`pnpm brand:guard`).

## Size

`pnpm size` (`scripts/size-budget.mjs`, `size-budget.json`) gates every route's own JS (gzip of the client entry plus the route chunk and their static imports) and the total including lazy chunks. `--json` prints the raw figures; `--update` re-seeds at 3% headroom. The budget was seeded from `main` at `ab8810b`. BRD-001 may grow only the total.

## CDN

`tools/brand/cdn/` is the static assets Worker `loci-cdn` on `cdn.lociai.fyi`. A new cut of the model is a new path (`/loci/mascot3d/v1/`, `v2/` …), never an overwrite. See the README there.

## Beta web Worker

`wrangler.jsonc` can't carry an `env` block (Nitro copies it into `.output/server/wrangler.json`, and Workers Builds rejects environments there). `deploy-beta.yml` builds normally with the model URL set, checks the size budget, runs `scripts/beta-wrangler.mjs` to rename the generated config to Worker `loci-client-beta` on `beta.lociai.fyi`, and deploys that file. It runs on every push to `main` and by hand. It is not connected to Workers Builds. `deploy-staging.yml` is older, targets a `staging` env that does not exist, and is left alone.

Signing in on beta needs `beta.lociai.fyi` allowed as an origin by the API and the auth provider. That is not needed to judge the mascot and is not done.

## Local dev note

Every server-rendered request in a local `vite dev` takes about 49 s when the PostHog middleware cannot reach its host (a sandboxed shell, offline). Static files are instant. It is not the mascot.

## Verified (2026-11-13, before any deploy)

Web, `vite dev` with the model URL set, sign-in at 1280 px, headless Chrome (SwiftShader) driven over CDP:

| Case | Canvas | Model fetched | Result |
|---|---|---|---|
| Normal | 1 | yes | live after the first frame |
| `prefers-reduced-motion: reduce` | 0 | no | still |
| Save-Data on | 0 | no | still |
| WebGL disabled | 0 | no | still |
| Model URL 404 | 0 | tried | still |

In a real Chrome, earlier: the swap is seamless, the pointer is followed, exactly one canvas on the landing page, and the loop pauses off-screen (rAF calls halved).

iOS, Beta build in the iPhone 17 Pro Max simulator (iOS 26.2): the mascot is live on LoginScreen; with Reduce Motion on, consecutive frames are identical and the still shows. `scripts/verify-release-no-mascot3d.sh` passes (Release 0 of 8 files and types, Beta 8 of 8). Not checkable in the simulator: Low Power Mode. **Known difference:** the iOS still is the web's three.js render, and RealityKit lights the model a shade more saturated, so the swap on iOS is visible. Judge it on the device; the fix, if wanted, is a still rendered by RealityKit.
