#!/usr/bin/env node
/**
 * Updates the generated proto package to the newest build on the BSR.
 *
 * This exists because `pnpm add @buf/...@latest` is not safe here. The BSR npm
 * registry's `latest` dist-tag lags behind the newest published build: after
 * proto v5.0.1 was pushed, `@latest` still resolved to a package built from the
 * previous commit, so running the old one-liner installed a package missing
 * `loci/memory` and the `scopes` field entirely.
 *
 * That failure is nasty because it is silent at install time and surfaces later
 * as missing-module type errors far from the cause. So: resolve the newest
 * *version*, not the newest tag, and refuse to finish if the installed package
 * is missing something we know must be there.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = "@buf/loci_loci-proto.bufbuild_es";
const REGISTRY = "https://buf.build/gen/npm/v1/";

/**
 * Modules that must exist after an update. Add to this when a new proto module
 * ships, so a stale package can never install quietly again.
 */
const REQUIRED = ["loci/memory", "loci/apikey", "loci/trip", "loci/auth"];

function run(cmd, args) {
  return execFileSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function newestVersion() {
  const raw = run("npm", ["view", PKG, "versions", "--json", `--registry=${REGISTRY}`]);
  const versions = JSON.parse(raw);
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error(`no published versions found for ${PKG}`);
  }
  // BSR versions embed a sortable build timestamp, so the last entry npm
  // reports is the newest build regardless of which one carries `latest`.
  return versions[versions.length - 1];
}

const version = newestVersion();
console.log(`[buf-update] newest published build: ${version}`);

run("pnpm", ["add", `${PKG}@${version}`]);

const installed = join(root, "node_modules", PKG);
const missing = REQUIRED.filter((mod) => !existsSync(join(installed, mod)));

if (missing.length > 0) {
  console.error(
    `[buf-update] installed ${version} but it is missing: ${missing.join(", ")}\n` +
      `[buf-update] the BSR build is behind the proto repo. Push the proto ` +
      `change, wait for the BSR to build it, then re-run — or bridge locally ` +
      `with \`pnpm proto-bridge\` in the meantime.`,
  );
  process.exit(1);
}

console.log(`[buf-update] ok — ${REQUIRED.length} expected modules present`);
