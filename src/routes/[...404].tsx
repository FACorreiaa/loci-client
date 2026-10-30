import { A } from "@solidjs/router";
import { Home, Search, Compass } from "lucide-solid";
import { Mascot } from "~/components/brand/Mascot";
import { Button } from "~/ui/button";

export default function NotFound() {
  return (
    <div class="min-h-screen flex items-center justify-center px-4 py-8">
      <div class="text-center max-w-md mx-auto loci-card p-8">
        <div class="mb-6 flex justify-center">
          <Mascot state="error" width={120} decorative idle />
        </div>

        {/* Error Message */}
        <h1 class="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-4">404</h1>
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
