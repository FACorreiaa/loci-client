#!/usr/bin/env bash
# Lay out tools/brand/out/cdn exactly as cdn.lociai.fyi serves it.
#   tools/brand/cdn/stage.sh v1      copies the current mascot.glb into /loci/mascot3d/v1/
# Earlier versions already in tools/brand/out/cdn are kept: every deploy
# replaces the whole set, so a version missing here disappears from the CDN.
set -euo pipefail
cd "$(dirname "$0")/../../.."
version="${1:?usage: stage.sh <version, e.g. v1>}"
model=tools/brand/out/mascot-3d/mascot.glb
[ -f "$model" ] || { echo "no $model; run tools/brand/mascot_3d.py first" >&2; exit 1; }
dest="tools/brand/out/cdn/loci/mascot3d/$version"
if [ -f "$dest/mascot.glb" ] && ! cmp -s "$model" "$dest/mascot.glb"; then
  echo "$dest/mascot.glb exists and differs: a new cut needs a new version" >&2
  exit 1
fi
mkdir -p "$dest"
cp "$model" "$dest/mascot.glb"
cp tools/brand/cdn/_headers tools/brand/out/cdn/_headers
find tools/brand/out/cdn -type f | sort
