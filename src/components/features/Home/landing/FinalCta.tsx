import { A } from "@solidjs/router";
import RouteStop from "./RouteStop";
import AppButtons from "./AppButtons";

export default function FinalCta() {
  return (
    <RouteStop id="pricing" class="pt-24 pb-4">
      <div class="rounded-3xl border border-border bg-card px-7 py-12 text-center sm:py-14">
        <span class="font-coord text-xs uppercase tracking-[0.18em] text-accent">destination</span>
        <h2 class="mx-auto mt-3 max-w-[20ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Your next trip is one sentence away.
        </h2>
        <p class="mx-auto mt-3.5 max-w-[52ch] text-muted-foreground">
          Start free — plot a city today. Upgrade to Pro when you want unlimited itineraries and
          agent access.
        </p>
        <div class="mt-7 flex flex-wrap justify-center gap-3">
          <A
            href="/auth/signup"
            class="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground transition hover:opacity-90"
          >
            Plot a trip free
          </A>
          <A
            href="/pricing"
            class="inline-flex items-center rounded-lg border border-border px-5 py-2.5 font-medium transition hover:bg-muted/50"
          >
            See Pro plans
          </A>
        </div>
        <AppButtons class="mt-4 justify-center" />
      </div>
    </RouteStop>
  );
}
