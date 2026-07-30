import { A } from "@solidjs/router";
import { MapPin, Home, Search, Compass } from "lucide-solid";
import { Button } from "~/ui/button";

export default function NotFound() {
  return (
    <div class="min-h-screen flex items-center justify-center px-4 py-8">
      <div class="text-center max-w-md mx-auto loci-card p-8">
        {/* Animated Icon */}
        <div class="mb-8 relative">
          <div class="w-24 h-24 mx-auto bg-primary rounded-full flex items-center justify-center shadow-lg ring-4 ring-border animate-pulse">
            <MapPin class="w-12 h-12 text-primary-foreground" />
          </div>
          <div class="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center shadow-lg">
            <span class="text-accent-foreground text-xs font-bold">!</span>
          </div>
        </div>

        {/* Error Message */}
        <h1 class="text-4xl sm:text-5xl font-bold text-foreground mb-4">404</h1>
        <h2 class="text-xl sm:text-2xl font-semibold text-muted-foreground mb-4">
          Destination Not Found
        </h2>
        <p class="text-muted-foreground mb-8 leading-relaxed">
          Looks like this location doesn't exist on our travel map. Let's get you back on track to
          discover amazing places!
        </p>

        {/* Action Buttons */}
        <div class="space-y-3 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
          <Button as={A} href="/" class="w-full sm:w-auto gap-2">
            <Home class="w-4 h-4" />
            Back to Home
          </Button>
          <Button variant="outline" as={A} href="/chat" class="w-full sm:w-auto gap-2">
            <Search class="w-4 h-4" />
            Start Planning
          </Button>
        </div>

        {/* Quick Navigation */}
        <div class="mt-12 pt-8 border-t border-border">
          <p class="text-sm text-muted-foreground mb-4">Or explore these popular destinations:</p>
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
            <Compass class="w-4 h-4 text-primary" />
            <span class="text-sm font-medium text-foreground">Travel Tip</span>
          </div>
          <p class="text-xs text-muted-foreground">
            Lost pages are like hidden destinations - sometimes the best adventures happen when
            you're off the beaten path!
          </p>
        </div>
      </div>
    </div>
  );
}
