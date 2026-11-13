# Loci backlog

Items that are decided but not done. Each carries a **Done when** so it can be closed by measurement, not by feel.

## BRD-001 — 3D mascot

The existing Loci mascot as a real-time 3D model, on beta builds only, judged by the owner on a device before anything reaches production. Shape copied from Aaru BRD-011. Decided 2026-11-13.

- **Where:** web — landing "Your guide" slot and the desktop sign-in aside, on `beta.lociai.fyi` only. iOS — `LoginScreen`, above a smaller lockup, in Debug and Beta builds only.
- **Motion:** idle breath, eyes and body follow the pointer or touch, blink, amber ring pulse. Data in `design/mascot-motion.json`; rules in `DESIGN.md` → Visual language.
- **Model:** built by `tools/brand/mascot_3d.py` from the owner's source GLBs (kept out of git). Web model on `cdn.lociai.fyi/loci/mascot3d/v<n>/`; the Apple model is bundled in Beta only.
- **Mechanics:** `docs/MASCOT_3D.md`; iOS side in `loci-ios/docs/ios/ARCHITECTURE.md`.

**Done when:**

- the 3D mascot renders on `beta.lociai.fyi`'s landing and sign-in aside, and on a Loci Beta TestFlight build's login screen on iPhone;
- the production web bundle contains no mascot3d chunk and no model URL;
- the Release iOS app passes `scripts/verify-release-no-mascot3d.sh` (no `.usdz`, no `Mascot3DView` symbol), with the Beta build as the positive control;
- every route's own size budget is unchanged (only the lazy total grows);
- the owner has said go or no-go, written here with the measurements: GLB KB, draw calls, triangles, lazy chunk gzip, first-frame time on device.

**Verdict:** go, straight to production (owner, 2026-11-13), without the beta-only device stage. The 3D mascot is in the production web build (`.env.production` sets the model URL) and in every iOS build; the beta-only rows above describe the experiment as planned and are kept for the record. Measured: GLB 807 KB (826,744 B), 23 draw calls, 67,008 triangles; glTF loader chunk 12.7 KB gzip; every route's own budget unchanged. Still owed: first-frame time on a device, and the owner's look at the iOS swap (the iOS still is the web's three.js render, and RealityKit lights the model differently).
