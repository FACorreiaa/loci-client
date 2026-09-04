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

// Product analytics. No key configured means no analytics: the module is a
// no-op, which is the normal state in development. Loaded here rather than in
// app.tsx because posthog-js is browser-only and app.tsx also renders on the
// server.
void (async () => {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;
  const [{ initAnalytics }, posthog] = await Promise.all([
    import("~/lib/analytics"),
    import("posthog-js"),
  ]);
  initAnalytics({
    key,
    host: import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
    client: posthog.default,
  });
})();
