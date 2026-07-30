/**
 * Lighthouse CI config.
 *
 * Run with `pnpm lighthouse`. It builds the app, serves the build, and audits
 * the routes below three times each (Lighthouse is noisy; LHCI takes the median).
 *
 * The assertions are a *baseline ratchet*, not a wish. Start them where the app
 * actually is, then raise them as things improve — an assertion set to 1.0 on
 * day one just gets ignored. Update the numbers when you beat them.
 */
module.exports = {
  ci: {
    collect: {
      // Public routes only: anything behind auth would just audit the sign-in
      // redirect. Add authenticated routes via a Puppeteer script when you care
      // about them.
      url: [
        "http://localhost:8788/",
        "http://localhost:8788/discover",
        "http://localhost:8788/pricing",
        "http://localhost:8788/about",
      ],
      numberOfRuns: 3,
      // The build targets the Cloudflare Workers preset, so `vinxi start` cannot
      // run it under plain Node (it fails on the `cloudflare:` import scheme).
      // Serve it the same way `pnpm preview` does.
      startServerCommand: "npx wrangler dev --port 8788",
      startServerReadyPattern: "Ready on|Listening on|localhost:8788",
      startServerReadyTimeout: 180000,
      settings: {
        preset: "desktop",
      },
      // NOTE: headless Chrome follows the host OS colour scheme, and Lighthouse
      // has no setting to pin it. The two themes have genuinely different
      // contrast characteristics — opacity on `primary-foreground` fades
      // near-white over dark green in light mode and near-black over light sage
      // in dark mode — so the same commit used to score differently run to run.
      // The fix was to stop relying on alpha for footer text rather than to
      // pretend the run is deterministic. To audit dark mode deliberately, add
      // "--force-dark-mode" here and re-run.
      chromeFlags: ["--force-color-profile=srgb"],
    },
    assert: {
      assertions: {
        // Ratcheted to the 2026-07-25 baseline (perf 98-100, a11y 100, bp 96,
        // seo 100), set a notch below each so normal run-to-run noise does not
        // fail the build. Raise them again when the scores do.
        "categories:performance": ["error", { minScore: 0.95 }],
        "categories:accessibility": ["error", { minScore: 1.0 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 1.0 }],

        // The specific things that tend to regress silently on this app.
        "unused-javascript": "off",
        "uses-responsive-images": "warn",
        "color-contrast": "error",
        "meta-description": "error",
      },
    },
    upload: {
      // Local HTML reports; no LHCI server to talk to.
      target: "filesystem",
      outputDir: "./.lighthouse",
      reportFilenamePattern: "%%PATHNAME%%-report.%%EXTENSION%%",
    },
  },
};
