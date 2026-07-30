#!/usr/bin/env node
/**
 * Copies locally-generated proto TS into the @buf npm package, rewriting import
 * paths to match the published BSR layout.
 *
 * This is the dev bridge for proto changes that are not on the BSR yet: the
 * server picks them up through its go.mod `replace`, and this does the same for
 * the client. Runs on postinstall, so it survives `pnpm install`.
 *
 * Currently bridging:
 *   - compare/v1   (CompareService)
 *   - localcontext (GoScore / GetGoScore — the "should I go this weekend?" score)
 *
 * When these land on the BSR, drop the matching entry from MODULES and run
 * `pnpm buf-update`.
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const protoGenTs = join(root, "../loci-connect-proto/gen/ts");
const bufPkg = join(root, "node_modules/@buf/loci_loci-proto.bufbuild_es");

// Generated code imports siblings without a .js extension, which Node's ESM
// resolver rejects inside node_modules, and reaches protovalidate by relative
// path, which does not exist there.
//
// These are applied as patterns rather than a list of module pairs: enumerating
// them meant every newly bridged module broke at runtime until someone noticed
// the missing entry (trip_pb's imports of common/poi/recommendation did exactly
// that).
const PROTOVALIDATE = "@buf/bufbuild_protovalidate.bufbuild_es/buf/validate/validate_pb.js";

function rewriteImports(text) {
  return (
    text
      // Any depth of relative path to protovalidate becomes the package import.
      .replace(/from "(?:\.\.\/)+buf\/validate\/validate_pb(?:\.js)?"/g, `from "${PROTOVALIDATE}"`)
      // Every other relative *_pb import needs an explicit .js.
      .replace(/from "((?:\.\.?\/)[^"]*_pb)"/g, 'from "$1.js"')
  );
}

const MODULES = [
  { dir: "loci/compare/v1", files: ["compare_pb.js", "compare_pb.d.ts"] },
  { dir: "loci/localcontext", files: ["localcontext_pb.js", "localcontext_pb.d.ts"] },
  // city: SearchCitiesRequest.query dropped its min_len so the picker's initial
  // "browse" call (which sends an empty query) stops failing validation.
  { dir: "loci/city", files: ["city_pb.js", "city_pb.d.ts"] },
  // review: CreateReviewRequest required user_id, content_id and language, none
  // of which the server reads (it takes the author from the token), so writing a
  // review always failed validation.
  { dir: "loci/review", files: ["review_pb.js", "review_pb.d.ts"] },
  // trip: TripDay gained a city and TripDraft gained legs, so a trip can span
  // any number of cities across any number of days.
  { dir: "loci/trip", files: ["trip_pb.js", "trip_pb.d.ts"] },
  // auth: MFA step-up. LoginResponse gained mfa_required/mfa_token and dropped
  // the min_len on its token fields — an MFA challenge carries no tokens, so the
  // old constraint made the challenge response literally unsendable.
  { dir: "loci/auth", files: ["auth_pb.js", "auth_pb.d.ts"] },
];

let synced = 0;

for (const mod of MODULES) {
  const srcDir = join(protoGenTs, mod.dir);
  const destDir = join(bufPkg, mod.dir);

  if (!existsSync(srcDir)) {
    console.warn(`[sync-proto] skip ${mod.dir}: not generated at ${srcDir}`);
    continue;
  }

  mkdirSync(destDir, { recursive: true });

  for (const name of mod.files) {
    const dest = join(destDir, name);
    cpSync(join(srcDir, name), dest);

    writeFileSync(dest, rewriteImports(readFileSync(dest, "utf8")));
  }

  synced += 1;
  console.log(`[sync-proto] synced ${mod.dir}`);
}

if (synced === 0) {
  console.warn("[sync-proto] nothing synced — is loci-connect-proto generated?");
}
