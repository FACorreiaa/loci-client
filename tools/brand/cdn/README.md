# cdn.lociai.fyi

Loci's own address for brand media too heavy for git. Today it holds one file: the 3D mascot's web model (BRD-001), `/loci/mascot3d/v1/mascot.glb`, which the beta build's `VITE_MASCOT_3D_URL` points at (`.github/workflows/deploy-beta.yml`). Copied from Aaru's `docs/brand/cdn`.

A Cloudflare Worker with static assets and no code (`wrangler.jsonc`). One small file does not need a bucket.

## Rules

- **A new cut is a new path.** Files are cached for a year as immutable, so `v1` is never overwritten: the next model goes to `v2`, and `MASCOT_3D_URL` in `deploy-beta.yml` changes with it. `stage.sh` refuses to overwrite a version with different bytes.
- **Every deploy replaces the whole set.** A file missing from `tools/brand/out/cdn` disappears from the address, so keep earlier versions there while anything still points at them.
- Nothing personal and nothing secret goes here. Every file is public and readable from any site (`Access-Control-Allow-Origin: *`).

## Deploy

```sh
python3 -I tools/brand/mascot_3d.py --hero <abs path> --web <abs path>   # build the model
tools/brand/cdn/stage.sh v1                                              # lay it out
npx wrangler deploy --config tools/brand/cdn/wrangler.jsonc             # needs Workers + DNS edit on lociai.fyi
curl -sI https://cdn.lociai.fyi/loci/mascot3d/v1/mascot.glb             # expect 200, immutable, ACAO *
```
