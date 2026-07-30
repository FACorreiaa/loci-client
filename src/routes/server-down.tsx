import { A } from "@solidjs/router";
import { Component, createSignal, onMount } from "solid-js";
import { ServerCrash, RefreshCw, Home, Wifi, AlertTriangle, Compass } from "lucide-solid";
import { Button } from "~/ui/button";

const ServerDownPage: Component = () => {
  const [isRetrying, setIsRetrying] = createSignal(false);
  const [lastAttempt, setLastAttempt] = createSignal<Date | null>(null);

  const handleRetry = async () => {
    setIsRetrying(true);
    setLastAttempt(new Date());

    try {
      // Test connection to the server
      const response = await fetch("/api/v1/health", {
        method: "GET",
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        // Server is back up, reload the page
        window.location.reload();
      } else {
        throw new Error("Server still unavailable");
      }
    } catch (error) {
      console.log("Server still down:", error);
      // Keep the retry button enabled for another attempt
    } finally {
      setIsRetrying(false);
    }
  };

  // Auto-retry every 30 seconds
  onMount(() => {
    const interval = setInterval(() => {
      if (!isRetrying()) {
        handleRetry();
      }
    }, 30000);

    return () => clearInterval(interval);
  });

  return (
    <div class="min-h-screen flex items-center justify-center px-4 py-8">
      <div class="text-center max-w-lg mx-auto loci-card p-8">
        {/* Animated Icon */}
        <div class="mb-8 relative">
          <div class="w-24 h-24 mx-auto bg-destructive rounded-full flex items-center justify-center animate-pulse shadow-lg ring-4 ring-border">
            <ServerCrash class="w-12 h-12 text-destructive-foreground" />
          </div>
          <div class="absolute -top-1 -right-1 w-8 h-8 bg-accent rounded-full flex items-center justify-center animate-bounce shadow-lg">
            <AlertTriangle class="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Error Message */}
        <h1 class="text-4xl sm:text-5xl font-bold text-foreground mb-4">Server Unavailable</h1>
        <h2 class="text-xl sm:text-2xl font-semibold text-muted-foreground mb-4">
          Connection Refused
        </h2>
        <p class="text-muted-foreground mb-8 leading-relaxed">
          We can't reach our travel servers right now. This could be due to server maintenance,
          network issues, or the server being temporarily down.
        </p>

        {/* Status Information */}
        <div class="mb-8 p-4 loci-card text-left">
          <div class="flex items-center justify-center gap-2 mb-3">
            <Wifi class="w-5 h-5 text-destructive" />
            <span class="font-medium text-foreground">Connection Status</span>
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Server:</span>
              <span class="text-destructive font-medium">Unreachable</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Last Check:</span>
              <span class="text-foreground">
                {lastAttempt() ? lastAttempt()!.toLocaleTimeString() : "Never"}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Auto-retry:</span>
              <span class="text-accent">Every 30s</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div class="space-y-3 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center mb-8">
          <Button onClick={handleRetry} disabled={isRetrying()} class="w-full sm:w-auto gap-2">
            <RefreshCw class={`w-4 h-4 ${isRetrying() ? "animate-spin" : ""}`} />
            {isRetrying() ? "Checking..." : "Try Again"}
          </Button>
          <Button variant="outline" as={A} href="/" class="w-full sm:w-auto gap-2">
            <Home class="w-4 h-4" />
            Back to Home
          </Button>
        </div>

        {/* Offline Features */}
        <div class="mb-8 p-4 loci-card text-left">
          <h3 class="font-semibold text-foreground mb-3">What you can do while we're down:</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div class="flex items-center gap-2 text-muted-foreground">
              <span class="w-2 h-2 bg-primary rounded-full" />
              Browse cached content
            </div>
            <div class="flex items-center gap-2 text-muted-foreground">
              <span class="w-2 h-2 bg-primary rounded-full" />
              View saved favorites
            </div>
            <div class="flex items-center gap-2 text-muted-foreground">
              <span class="w-2 h-2 bg-primary rounded-full" />
              Read downloaded itineraries
            </div>
            <div class="flex items-center gap-2 text-muted-foreground">
              <span class="w-2 h-2 bg-primary rounded-full" />
              Plan future trips
            </div>
          </div>
        </div>

        {/* Quick Navigation */}
        <div class="pt-6 border-t border-border">
          <p class="text-sm text-muted-foreground mb-4">Try these offline-friendly features:</p>
          <div class="flex flex-wrap justify-center gap-3">
            <A
              href="/favorites"
              class="inline-flex items-center gap-1 px-3 py-2 text-xs bg-card text-muted-foreground rounded-full border border-border hover:bg-muted transition-colors"
            >
              ❤️ Favorites
            </A>
            <A
              href="/lists"
              class="inline-flex items-center gap-1 px-3 py-2 text-xs bg-card text-muted-foreground rounded-full border border-border hover:bg-muted transition-colors"
            >
              📝 Lists
            </A>
            <A
              href="/profile"
              class="inline-flex items-center gap-1 px-3 py-2 text-xs bg-card text-muted-foreground rounded-full border border-border hover:bg-muted transition-colors"
            >
              👤 Profile
            </A>
          </div>
        </div>

        {/* Travel Tip */}
        <div class="mt-8 p-4 loci-card text-left">
          <div class="flex items-center justify-center gap-2 mb-2">
            <Compass class="w-4 h-4 text-accent" />
            <span class="text-sm font-medium text-foreground">Travel Tip</span>
          </div>
          <p class="text-xs text-muted-foreground">
            Server downtime is like weather delays - they happen! Use this time to review your saved
            places or plan your next adventure. We'll be back online soon! ✈️
          </p>
        </div>
      </div>
    </div>
  );
};

export default ServerDownPage;
