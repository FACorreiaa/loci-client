import { A } from "@solidjs/router";
import { AlertTriangle, Home, Compass, RefreshCw } from "lucide-solid";
import { Button } from "~/ui/button";

export default function ServerError() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div class="min-h-screen flex items-center justify-center px-4 py-8">
      <div class="text-center max-w-md mx-auto loci-card p-8">
        {/* Animated Icon */}
        <div class="mb-8 relative">
          <div class="w-24 h-24 mx-auto bg-destructive rounded-full flex items-center justify-center animate-pulse shadow-lg ring-4 ring-border">
            <AlertTriangle class="w-12 h-12 text-destructive-foreground" />
          </div>
          <div class="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center shadow-lg">
            <span class="text-accent-foreground text-xs font-bold">!</span>
          </div>
        </div>

        {/* Error Message */}
        <h1 class="text-4xl sm:text-5xl font-bold text-foreground mb-4">500</h1>
        <h2 class="text-xl sm:text-2xl font-semibold text-muted-foreground mb-4">Server Error</h2>
        <p class="text-muted-foreground mb-8 leading-relaxed">
          Our travel servers are experiencing some turbulence. Don't worry - our team is working to
          get everything back on track!
        </p>

        {/* Action Buttons */}
        <div class="space-y-3 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
          <Button onClick={handleRefresh} class="w-full sm:w-auto gap-2">
            <RefreshCw class="w-4 h-4" />
            Try Again
          </Button>
          <Button variant="outline" as={A} href="/" class="w-full sm:w-auto gap-2">
            <Home class="w-4 h-4" />
            Back to Home
          </Button>
        </div>

        {/* Quick Navigation */}
        <div class="mt-12 pt-8 border-t border-border">
          <p class="text-sm text-muted-foreground mb-4">While we fix things, try these features:</p>
          <div class="flex flex-wrap justify-center gap-3">
            <A
              href="/hotels"
              class="inline-flex items-center gap-1 px-3 py-2 text-xs bg-card text-muted-foreground rounded-full border border-border hover:bg-muted transition-colors"
            >
              🏨 Hotels
            </A>
            <A
              href="/restaurants"
              class="inline-flex items-center gap-1 px-3 py-2 text-xs bg-card text-muted-foreground rounded-full border border-border hover:bg-muted transition-colors"
            >
              🍽️ Restaurants
            </A>
            <A
              href="/activities"
              class="inline-flex items-center gap-1 px-3 py-2 text-xs bg-card text-muted-foreground rounded-full border border-border hover:bg-muted transition-colors"
            >
              🎯 Activities
            </A>
          </div>
        </div>

        {/* Fun Travel Tip */}
        <div class="mt-8 p-4 loci-card text-left">
          <div class="flex items-center justify-center gap-2 mb-2">
            <Compass class="w-4 h-4 text-accent" />
            <span class="text-sm font-medium text-foreground">Travel Tip</span>
          </div>
          <p class="text-xs text-muted-foreground">
            Even the best travel plans hit unexpected delays. Sometimes the best stories come from
            the unplanned moments!
          </p>
        </div>
      </div>
    </div>
  );
}
