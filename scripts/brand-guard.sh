#!/usr/bin/env bash
# Brand guards for the 3D mascot (BRD-001). Runs in CI on every push and PR.
#
#  1. The motion, fixture and rig JSON copies match design/ byte for byte.
#     loci-ios checks its own copies against this repo's design/ in its CI.
#  2. `three` is imported by src/lib/mascot3d/scene.ts and nothing else.
#  3. No colour literals in the 3D mascot's files: lights read brand tokens.
#     A pre-existing line can opt out with a `brand-guard: allow` comment.
set -euo pipefail
cd "$(dirname "$0")/.."
fail=0

for name in mascot-motion.json mascot-motion.fixtures.json mascot-rig.json; do
  copy="src/lib/mascot3d/$name"
  if ! cmp -s "design/$name" "$copy"; then
    echo "::error file=$copy::$copy has drifted from design/$name. Fix: cp design/$name $copy"
    fail=1
  fi
done

importers=$(grep -rlE --include='*.ts' --include='*.tsx' "from [\"']three(/|[\"'])|import\([\"']three(/|[\"'])" src || true)
for f in $importers; do
  if [ "$f" != "src/lib/mascot3d/scene.ts" ]; then
    echo "::error file=$f::imports three; only src/lib/mascot3d/scene.ts may (docs/MASCOT_3D.md)"
    fail=1
  fi
done

mascot_files="src/lib/mascot3d/scene.ts src/lib/mascot3d/flag.ts src/lib/mascot-motion.ts src/components/brand/Mascot3D.tsx src/components/brand/Mascot3DSlot.tsx"
literals=$(grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\([0-9]" $mascot_files | grep -v "brand-guard: allow" || true)
if [ -n "$literals" ]; then
  echo "$literals" | while IFS= read -r line; do
    echo "::error file=${line%%:*}::colour literal in a 3D mascot file; read a brand token instead: $line"
  done
  fail=1
fi

[ "$fail" -eq 0 ] && echo "brand guard ok"
exit "$fail"
