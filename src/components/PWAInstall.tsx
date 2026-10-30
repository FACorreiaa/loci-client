import { createSignal, onMount, Show } from "solid-js";
import { Button } from "@/ui/button";
import { Download, X } from "lucide-solid";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = createSignal<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = createSignal(false);
  const [isInstalled, setIsInstalled] = createSignal(false);
  const [showInstallBanner, setShowInstallBanner] = createSignal(false);

  onMount(() => {
    // Check if app is already installed
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone
    ) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Save the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);

      // Show install banner after a delay
      setTimeout(() => {
        setShowInstallBanner(true);
      }, 3000);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallButton(false);
      setShowInstallBanner(false);
      console.log("Loci PWA was installed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Cleanup
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  });

  const handleInstallClick = async () => {
    const prompt = deferredPrompt();
    if (!prompt) return;

    // Show the install prompt
    await prompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await prompt.userChoice;

    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowInstallButton(false);
    setShowInstallBanner(false);
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    // Remember user dismissed banner
    localStorage.setItem("pwa-install-banner-dismissed", "true");
  };

  // Don't show if dismissed recently
  const wasDismissed = () => {
    return localStorage.getItem("pwa-install-banner-dismissed") === "true";
  };

  return (
    <>
      {/* Install Button in Navbar */}
      <Show when={showInstallButton() && !isInstalled()}>
        <Button
          onClick={handleInstallClick}
          variant="ghost"
          size="sm"
          class="hidden md:flex items-center gap-2 text-primary hover:bg-primary/10 hover:text-primary"
          title="Install Loci App"
        >
          <Download class="w-4 h-4" />
          Install App
        </Button>
      </Show>

      {/* Install Banner */}
      <Show when={showInstallBanner() && !isInstalled() && !wasDismissed()}>
        <div class="island-panel fixed bottom-4 left-4 right-4 z-50 rounded-xl p-4 md:left-auto md:right-4 md:max-w-sm">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span class="font-display text-lg font-semibold">L</span>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-semibold text-foreground">Install Loci App</h3>
              <p class="mt-1 text-xs text-muted-foreground">
                Get the best experience with our mobile app. Install now for offline access and push
                notifications.
              </p>
              <div class="flex gap-2 mt-3">
                <Button onClick={handleInstallClick} size="sm" class="px-3 py-1.5 text-xs">
                  Install
                </Button>
                <Button
                  onClick={dismissBanner}
                  variant="ghost"
                  size="sm"
                  class="px-3 py-1.5 text-xs text-muted-foreground"
                >
                  Maybe Later
                </Button>
              </div>
            </div>
            <Button
              onClick={dismissBanner}
              variant="ghost"
              size="sm"
              // Icon-only dismiss: without a name it announces as "button".
              aria-label="Dismiss install prompt"
              class="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground"
            >
              <X class="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Show>
    </>
  );
}
