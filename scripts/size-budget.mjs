#!/usr/bin/env node
/**
 * JS size budget, per route and in total. Run after `vite build`.
 *
 *   pnpm size              check .output against size-budget.json
 *   pnpm size -- --update  re-seed the budget at 3% headroom
 *   pnpm size -- --json    print the raw figures
 *
 * A route's figure is the gzip size of everything the browser must load
 * before that route can run: the client entry plus the route chunk and their
 * static imports, deduplicated. Dynamic imports are excluded, which is the
 * point: lazy code (the map stack, the mascot renderer) is paid only by the
 * pages that reach for it, and is caught by `totalJs` instead — the gzip sum
 * of every client .js file.
 *
 * BRD-001 (3D mascot) may grow totalJs only; every route figure must hold.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, ".output/public");
const manifestPath = path.join(pub, ".vite/manifest.json");
const budgetPath = path.join(root, "size-budget.json");
const HEADROOM = 1.03;

if (!existsSync(manifestPath)) {
  console.error("no .output/public/.vite/manifest.json — run `vite build` first");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const gz = new Map();
const gzipOf = (file) => {
  if (!gz.has(file))
    gz.set(file, gzipSync(readFileSync(path.join(pub, file)), { level: 9 }).length);
  return gz.get(file);
};

function closure(key, seen = new Set()) {
  const chunk = manifest[key];
  if (!chunk || seen.has(chunk.file)) return seen;
  if (chunk.file.endsWith(".js")) seen.add(chunk.file);
  for (const dep of chunk.imports ?? []) closure(dep, seen);
  return seen;
}

const entryKey = "src/entry-client.tsx";
if (!manifest[entryKey]) {
  console.error(`manifest has no ${entryKey}`);
  process.exit(1);
}
const routeName = (key) => {
  const m = key.match(/^src\/routes\/(.+)\.tsx\?pick=/);
  if (!m) return null;
  const p = m[1].replace(/(^|\/)index$/, "");
  return "/" + p;
};

const figures = { routes: {}, totalJs: 0 };
for (const key of Object.keys(manifest).sort()) {
  const name = routeName(key);
  if (!name) continue;
  const files = closure(key, closure(entryKey));
  figures.routes[name] = [...files].reduce((sum, f) => sum + gzipOf(f), 0);
}
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? walk(path.join(dir, d.name))
      : d.name.endsWith(".js")
        ? [path.join(dir, d.name)]
        : [],
  );
for (const file of walk(path.join(pub, "_build")))
  figures.totalJs += gzipOf(path.relative(pub, file));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(figures));
  process.exit(0);
}

if (process.argv.includes("--update")) {
  const budget = {
    about:
      "gzip bytes; see scripts/size-budget.mjs. Re-seed with `pnpm size -- --update` only for a deliberate change.",
    routes: Object.fromEntries(
      Object.entries(figures.routes).map(([k, v]) => [k, Math.ceil(v * HEADROOM)]),
    ),
    totalJs: Math.ceil(figures.totalJs * HEADROOM),
  };
  writeFileSync(budgetPath, JSON.stringify(budget, null, 2) + "\n");
  console.log(`seeded ${Object.keys(budget.routes).length} routes, totalJs ${budget.totalJs}`);
  process.exit(0);
}

const budget = JSON.parse(readFileSync(budgetPath, "utf8"));
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
let failed = 0;
for (const [name, size] of Object.entries(figures.routes)) {
  const limit = budget.routes[name];
  if (limit === undefined) {
    console.log(`new route ${name}: ${kb(size)} (no budget; add one with --update)`);
    continue;
  }
  if (size > limit) {
    failed++;
    console.error(`over budget ${name}: ${kb(size)} > ${kb(limit)}`);
  }
}
if (figures.totalJs > budget.totalJs) {
  failed++;
  console.error(`over budget totalJs: ${kb(figures.totalJs)} > ${kb(budget.totalJs)}`);
}
const show = ["/", "/auth/signin", "/auth/signup"];
for (const r of show)
  console.log(`${r.padEnd(14)} ${kb(figures.routes[r])} / ${kb(budget.routes[r])}`);
console.log(`${"totalJs".padEnd(14)} ${kb(figures.totalJs)} / ${kb(budget.totalJs)}`);
if (failed) process.exit(1);
console.log("size budget ok");
