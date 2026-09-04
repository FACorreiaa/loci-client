// @refresh reload
/// <reference types="vite-plugin-pwa/client" />
import { mount, StartClient } from "@solidjs/start/client";
import { registerSW } from "virtual:pwa-register";

mount(() => <StartClient />, document.getElementById("app")!);

// Register service worker
if ("serviceWorker" in navigator) {
  registerSW({
    onNeedRefresh() {
      console.log("New content available, please refresh.");
      // You could show a toast notification here
    },
    onOfflineReady() {
      console.log("App ready to work offline");
      // You could show a toast notification here
    },
    onRegistered(r: any) {
      console.log("SW Registered: " + r);
    },
    onRegisterError(error: any) {
      console.log("SW registration error", error);
    },
  });
}

export default function () {}

// Product analytics is loaded here rather than in app.tsx because posthog-js
// is browser-only and app.tsx also renders on the server.
void (async () => {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST;

  if (import.meta.env.DEV && !key) {
    throw new Error(
      "VITE_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_KEY is configured",
    );
  }

  if (import.meta.env.DEV && !host) {
    throw new Error(
      "VITE_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_HOST is configured",
    );
  }

  if (!key || !host) return;

  // Keep browser and Connect-backend telemetry on the same person. The SDK
  // attaches its distinct and session ids only to this configured hostname.
  const backendHost = new URL(
    import.meta.env.VITE_CONNECT_BASE_URL || window.location.origin,
    window.location.origin,
  ).hostname;

  const [{ initAnalytics }, posthog] = await Promise.all([
    import("~/lib/analytics"),
    import("posthog-js"),
  ]);
  initAnalytics({ key, host, tracingHeaders: [backendHost], client: posthog.default });
})();
