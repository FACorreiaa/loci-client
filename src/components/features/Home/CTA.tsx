import { Button } from "@/ui/button";

export default function CTA() {
  return (
    <section
      class="w-full py-12 sm:py-16 md:py-20 relative overflow-hidden"
      aria-labelledby="cta-heading"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-white/20 dark:bg-slate-900/30"
        aria-hidden="true"
      />
      <div class="container text-center px-4 sm:px-6 lg:px-8 relative z-10">
        <div class="loci-card flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 px-5 py-6 sm:px-8 sm:py-8">
          <span
            id="cta-heading"
            class="text-base sm:text-lg text-foreground font-semibold tracking-tight"
          >
            Ready to explore smarter?
          </span>
          <Button
            class="bg-[#0c7df2] hover:bg-[#0a6ed6] text-white font-bold px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg rounded-lg w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 transition-all shadow-[0_14px_32px_rgba(12,125,242,0.22)] border border-white/20 dark:border-slate-800/60"
            aria-label="Sign up for Loci to get started for free"
          >
            Get Started for Free
          </Button>
        </div>
      </div>
    </section>
  );
}
