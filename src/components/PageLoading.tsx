/**
 * PageLoading is the route-transition fallback shown while a lazily-loaded
 * page resolves — replacing a blank flash on navigation. Keeps the
 * cartographic register (mono label, coral accent arc) and
 * respects reduced-motion.
 */
export default function PageLoading() {
  return (
    <div
      class="flex min-h-[60vh] flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <div class="relative h-10 w-10">
        <span class="absolute inset-0 rounded-full border-2 border-border" />
        <span class="absolute inset-0 animate-spin rounded-full border-2 border-accent border-t-transparent motion-reduce:animate-none" />
      </div>
      <span class="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
        plotting your route…
      </span>
    </div>
  );
}
