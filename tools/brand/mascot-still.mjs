#!/usr/bin/env node
/**
 * Render the 3D mascot's still (BRD-001): the first paint and fallback of
 * Mascot3D, drawn by the app's own scene at the rest pose, so the live canvas
 * replaces an identical picture.
 *
 *   node tools/brand/mascot-still.mjs [--model tools/brand/out/mascot-3d/mascot.glb]
 *
 * Starts a local page (printed below). Open it in Chrome; it renders one frame
 * and posts it back here, and this writes
 *   public/images/brand/mascot-3d-still.webp     (720x960)
 *   public/images/brand/mascot-3d-still-sm.webp  (360x480)
 * keeping the raw PNG in tools/brand/out/mascot-still/. It tries headless
 * Chrome first; where that cannot start (sandboxes), open the URL by hand.
 * Needs cwebp (Homebrew `webp`). Rerun after every model cut.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const modelArg = args.includes("--model")
  ? args[args.indexOf("--model") + 1]
  : "tools/brand/out/mascot-3d/mascot.glb";
const model = path.resolve(root, modelArg);
if (!existsSync(model)) {
  console.error(`no model at ${model}; run tools/brand/mascot_3d.py first`);
  process.exit(1);
}
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [W, H] = [720, 960];
const out = path.join(root, "tools/brand/out/mascot-still");
mkdirSync(out, { recursive: true });
const png = path.join(out, "mascot-3d-still.png");

let resolveFrame;
const frame = new Promise((r) => (resolveFrame = r));

const server = await createServer({
  configFile: false,
  root: path.join(root, "tools/brand/mascot-still"),
  publicDir: path.dirname(model),
  logLevel: "warn",
  resolve: { alias: { "~": path.join(root, "src") } },
  server: { host: "127.0.0.1", port: 0, strictPort: false },
  plugins: [
    {
      name: "mascot-still-upload",
      configureServer(s) {
        s.middlewares.use("/__mascot-still", (req, res) => {
          if (req.method !== "POST") return res.writeHead(405).end();
          const chunks = [];
          req.on("data", (c) => chunks.push(c));
          req.on("end", () => {
            const body = Buffer.concat(chunks).toString();
            const prefix = "data:image/png;base64,";
            if (!body.startsWith(prefix)) return res.writeHead(400).end();
            writeFileSync(png, Buffer.from(body.slice(prefix.length), "base64"));
            res.writeHead(204).end();
            resolveFrame();
          });
        });
      },
    },
  ],
});
await server.listen();
const url = server.resolvedUrls.local[0];
console.log(`open ${url} in Chrome if nothing happens`);

const headless = existsSync(CHROME)
  ? spawn(
      CHROME,
      [
        "--headless=new",
        "--no-first-run",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        `--window-size=${W},${H + 40}`,
        `--user-data-dir=${path.join(out, "chrome-profile")}`,
        url,
      ],
      { stdio: "ignore" },
    )
  : null;
headless?.on("error", () => {});

const timeout = setTimeout(() => {
  console.error("no frame after 5 minutes");
  process.exit(1);
}, 300_000);

try {
  await frame;
  clearTimeout(timeout);
  const brand = path.join(root, "public/images/brand");
  const webp = (dst, w, h) => {
    const r = spawnSync("cwebp", [
      "-quiet",
      "-q",
      "90",
      "-alpha_q",
      "100",
      "-exact",
      "-resize",
      String(w),
      String(h),
      png,
      "-o",
      dst,
    ]);
    if (r.status !== 0) throw new Error(`cwebp failed: ${r.stderr}`);
  };
  webp(path.join(brand, "mascot-3d-still.webp"), W, H);
  webp(path.join(brand, "mascot-3d-still-sm.webp"), W / 2, H / 2);
  for (const f of ["mascot-3d-still.webp", "mascot-3d-still-sm.webp"]) {
    console.log(`${f}  ${(readFileSync(path.join(brand, f)).length / 1024).toFixed(0)} KB`);
  }
} finally {
  headless?.kill();
  await server.close();
}
