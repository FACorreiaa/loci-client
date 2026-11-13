#!/usr/bin/env node
/**
 * Turn the generated .output/server/wrangler.json into the beta Worker's
 * config (BRD-001): Worker `loci-client-beta` on beta.lociai.fyi.
 *
 * wrangler.jsonc cannot carry an `env` block (Nitro copies it into the
 * generated config and Workers Builds rejects environments there), so the
 * beta deploy rewrites the generated file after a normal build instead.
 * Run after `pnpm run build`; deploy with
 *   wrangler deploy --config .output/server/wrangler.json
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = ".output/server/wrangler.json";
const config = JSON.parse(readFileSync(path, "utf8"));
config.name = "loci-client-beta";
config.routes = [{ pattern: "beta.lociai.fyi", custom_domain: true }];
writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
console.log(`${path}: name=${config.name} routes=${config.routes.map((r) => r.pattern).join(",")}`);
